# Settle implementation specification

Single source of truth for all Settle agents. If an agent file and this
document disagree, this document wins. Plain ASCII only, in every file.

## 1. Product

A client funds a milestone with PayPal using intent AUTHORIZE (funds held,
not paid). The freelancer submits a GitHub repository. A Gemini Reviewer
scores it against the acceptance criteria. The AI never moves money.
- Client approves: full capture.
- Client disputes: two AI mediators negotiate a release percent. When both
  parties accept, one partial capture with final_capture=true is made.
- Deal cancelled: the authorization is voided.

No auth. A role cookie selects the view: name `settle_role`, values
`FREELANCER` or `CLIENT`, default `CLIENT`, path `/`, 1 year.

## 2. Stack and project rules

- Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui (base-ui).
  Read AGENTS.md: check node_modules/next/dist/docs before using a Next API.
- Route handler and page `params` are Promises: `const { id } = await params`.
- cacheComponents is OFF. Pages and GET handlers that read the database
  export `const dynamic = "force-dynamic"`.
- Prisma 6 + Postgres (Neon). Import the client only from lib/db.ts.
- PayPal: @paypal/paypal-server-sdk 2.5.0, sandbox only, through lib/paypal.ts.
  Routes never import the SDK directly.
- AI: `ai` + `@ai-sdk/google`, generateObject with the zod schemas in lib/ai.ts.
- ag-grid-community + ag-grid-react 36 for the dashboard table.
- Secrets only from env: DATABASE_URL, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET,
  PAYPAL_WEBHOOK_ID, GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_MODEL (optional),
  GITHUB_TOKEN (optional).
- Styling: use the tokens already in app/globals.css (Tailwind colours:
  background, foreground, muted-foreground, surface, surface2, line, line2,
  faint, em, em-soft, on-em, blue, blue-soft, amber, amber-soft, red,
  red-soft, chip, glass; classes .panel .btn-em .btn-line .field .eyebrow
  .shimmer). Add tokens with targeted edits; never replace the stylesheet.
- No git commit, no git push. Run `npx tsc --noEmit` and `npm run build`
  after each stage.
- Keep every shell command under 7000 characters: longer commands are cut
  off by the shell on this machine. Write large files with the Write tool.

## 3. Data model (prisma/schema.prisma)

Money columns are `Decimal @db.Decimal(10, 2)`. In JSON, money is a string
with two decimals, for example "50.00". Dates are ISO strings.

Deal: id (cuid), title, brief, clientName, clientEmail String?,
freelancerName, milestones[], createdAt, updatedAt.

Milestone: id, dealId, position Int, title, criteria Json (string[]),
amount, status String default "DRAFT", heldAmount default 0,
releasedAmount default 0, refundedAmount default 0, deliverableUrl String?,
deliverableNote String?, reviewScore Int?, reviewVerdict String?,
orderId String? @unique, authorizationId String? @unique, captureId String?,
reviews[], mediations[], events[], createdAt, updatedAt. Index on dealId.

Review: id, milestoneId, kind String ("REVIEW" | "MEDIATION"),
verdict String?, score Int?, result Json, deliverableUrl String?, createdAt.
- kind REVIEW: result is ReviewOutput; verdict and score are set.
- kind MEDIATION: one row per turn; result is
  { round: number, speaker: "FREELANCER_MEDIATOR" | "CLIENT_MEDIATOR",
  message: string }.

Mediation: id, milestoneId, status String default "OPEN"
("OPEN" | "ACCEPTED_BY_FREELANCER" | "ACCEPTED_BY_CLIENT" | "SETTLED"),
proposedReleasePercent Int?, rationale String?, createdAt, updatedAt.
One active Mediation per milestone (the newest row).

Event: id, milestoneId String? (null for unmatched webhooks), type String,
payload Json, createdAt. Index on milestoneId.

Event types: ORDER_CREATED, FUNDED, SUBMITTED, REVIEWED, APPROVED, RELEASED,
VOIDED, DISPUTED, MEDIATION_PROPOSED, SETTLEMENT_ACCEPTED, SETTLED,
PAYMENT_FAILED, WEBHOOK_RECEIVED. Payloads carry amounts as strings and any
PayPal ids (orderId, authorizationId, captureId).

## 4. Milestone status lifecycle

| From | Action (route) | To | Money fields |
| --- | --- | --- | --- |
| DRAFT, VOIDED | authorize | FUNDED | heldAmount = amount |
| FUNDED, REVIEWED | submit | SUBMITTED | - |
| SUBMITTED | ai review | REVIEWED | - |
| REVIEWED | approve | RELEASED | releasedAmount = amount, heldAmount = 0 |
| FUNDED, SUBMITTED, REVIEWED | void | VOIDED | refundedAmount = amount, heldAmount = 0 |
| REVIEWED | dispute | DISPUTED | - |
| DISPUTED | settlement accept (both) | SETTLED | released + refunded = amount, heldAmount = 0 |

Any other transition returns 409. Re-funding a VOIDED milestone resets
refundedAmount to 0. Invariant: heldAmount + releasedAmount + refundedAmount
is 0 (never funded) or equal to amount.

## 5. Payment rules (money agent)

1. The order amount is always read from the database, never from the request.
2. Full capture happens only in /approve. Partial capture happens only in
   /settlement/accept. No other code calls captureAuthorization.
3. Claim before capture: move the row with `updateMany` guarded by the
   expected status (or Mediation status) and proceed only when count is 1,
   so two concurrent requests cannot both capture. On PayPal failure, restore
   the previous status and log PAYMENT_FAILED.
4. Send a stable PayPal-Request-Id per operation: `authorize-<orderId>`,
   `approve-<milestoneId>`, `void-<milestoneId>`, `settle-<mediationId>`.
5. Settlement amount = amount * percent / 100, rounded to 2 decimals with
   Decimal math. percent 0: void only, no capture. percent 100: full capture
   with finalCapture true. Otherwise captureAuthorization(authId, part, true).
6. A milestone without authorizationId (seed data) cannot be captured or
   voided: return 409 with a clear message, do not call PayPal.
7. Webhook: read the raw body with request.text(), verify, then act.
   Never trust an unverified webhook. Webhook updates must be idempotent and
   must never move a RELEASED or SETTLED milestone backwards.

Verified against the installed SDK type definitions and the PayPal REST
reference (the APIMatic / PayPal AI Toolkit plugin is not installed):
- OrdersController.createOrder({ body: { intent: CheckoutPaymentIntent.Authorize,
  purchaseUnits: [{ amount: { currencyCode, value }, description, customId }],
  paymentSource }, paypalRequestId, prefer }) -> POST /v2/checkout/orders
- OrdersController.authorizeOrder({ id, paypalRequestId, prefer })
  -> POST /v2/checkout/orders/{id}/authorize. Authorization id is at
  purchaseUnits[0].payments.authorizations[0].id; held when status is CREATED.
- PaymentsController.captureAuthorizedPayment({ authorizationId,
  paypalRequestId, prefer, body: { amount?, finalCapture } })
  -> POST /v2/payments/authorizations/{id}/capture. finalCapture is sent as
  final_capture. Capture status: COMPLETED, DECLINED, PARTIALLY_REFUNDED,
  PENDING, REFUNDED, FAILED.
- PaymentsController.voidPayment({ authorizationId, paypalRequestId, prefer })
  -> POST /v2/payments/authorizations/{id}/void
- OrdersController.getOrder({ id })
- Webhook verification is not in the SDK. lib/paypal.ts calls
  POST /v1/notifications/verify-webhook-signature with auth_algo, cert_url,
  transmission_id, transmission_sig, transmission_time, webhook_id and
  webhook_event; success is verification_status "SUCCESS".
- Authorizations expire (3-day honor period, 29-day validity).
NOT confirmed from documentation, must be confirmed in the sandbox: that a
partial capture with final_capture=true releases the uncaptured remainder
without a separate void call.

## 6. API contract

Errors: `{ "error": string, "details"?: unknown }` with 400 (bad input),
404, 409 (wrong status), 422 (unusable deliverable or authorization not
held), 502 (PayPal, GitHub or Gemini failed), 503 (missing configuration).
All bodies are JSON. Types live in lib/types.ts under the names given.

Shared shapes:
- MilestoneStatus = "DRAFT" | "FUNDED" | "SUBMITTED" | "REVIEWED" |
  "RELEASED" | "DISPUTED" | "SETTLED" | "VOIDED"
- Role = "FREELANCER" | "CLIENT"
- MilestoneDTO { id, dealId, position, title, criteria: string[], amount,
  status, heldAmount, releasedAmount, refundedAmount, deliverableUrl,
  deliverableNote, reviewScore, reviewVerdict, updatedAt }
- ReviewDTO { id, milestoneId, kind, verdict, score, result, deliverableUrl,
  createdAt }
- MediationDTO { id, milestoneId, status, proposedReleasePercent, rationale,
  createdAt }
- EventDTO { id, milestoneId, type, payload, createdAt }
- DealDTO { id, title, brief, clientName, clientEmail, freelancerName,
  createdAt, milestones: MilestoneDTO[] }
- DealDetailDTO = DealDTO & { reviews: ReviewDTO[], mediations:
  MediationDTO[], events: EventDTO[] } (events newest first)

Money routes (money agent):
- POST /api/paypal/orders
  body CreateOrderRequest { milestoneId: string }
  200 CreateOrderResponse { orderId: string }
- POST /api/paypal/orders/[orderId]/authorize
  no body. 200 AuthorizeResponse { status: "FUNDED", authorizationId: string }
- POST /api/milestones/[id]/approve
  no body. 200 ApproveResponse { status: "RELEASED", captureId: string,
  releasedAmount: string }
- POST /api/milestones/[id]/void
  no body. 200 VoidResponse { status: "VOIDED", refundedAmount: string }
- POST /api/milestones/[id]/settlement/accept
  body AcceptSettlementRequest { role: Role }
  200 AcceptSettlementResponse { mediationStatus, milestoneStatus,
  settled: boolean, releasedAmount?: string, refundedAmount?: string,
  captureId?: string }
- POST /api/webhooks/paypal
  raw PayPal event. 200 { received: true }; 400 on a bad signature.
  Handles PAYMENT.CAPTURE.COMPLETED and PAYMENT.AUTHORIZATION.VOIDED.
- GET /api/health -> HealthResponse { ok: boolean, db: "up" | "down" }

AI and data routes (ai agent):
- POST /api/ai/scope
  body ScopeRequest { title: string, brief: string }
  200 ScopeResponse = ScoperOutput { milestones: { title, criteria: string[],
  amountUSD: number }[] }. Saves nothing.
- POST /api/deals
  body CreateDealRequest { title, brief, clientName, clientEmail,
  freelancerName?: string, milestones: { title, criteria: string[],
  amountUSD: number }[] }
  201 CreateDealResponse { id: string }
- GET /api/deals/[id] -> 200 DealDetailDTO
- POST /api/milestones/[id]/submit
  body SubmitRequest { deliverableUrl: string, note?: string }
  deliverableUrl must match github.com/<owner>/<repo>. Sets SUBMITTED, then
  runs the review in the same request.
  200 SubmitResponse { status: MilestoneStatus, review: ReviewDTO | null,
  reviewError?: string } (status stays SUBMITTED when the review failed)
- POST /api/ai/review/[milestoneId]
  no body. 200 ReviewResponse { review: ReviewDTO, cached: boolean }
  Returns the existing REVIEW for the same deliverableUrl instead of calling
  Gemini again. Never captures money.
- POST /api/milestones/[id]/dispute
  body DisputeRequest { reason?: string }
  200 DisputeResponse { status: "DISPUTED", mediation: MediationDTO }
- POST /api/ai/mediate/[milestoneId]
  no body. Runs 1 to 2 rounds between a freelancer-side and a client-side
  mediator, saves each turn as a Review (kind MEDIATION), then sets
  proposedReleasePercent and rationale and resets Mediation.status to OPEN.
  409 when the Mediation is SETTLED. Moves no money.
  200 MediateResponse { mediation: MediationDTO, turns: ReviewDTO[] }

Zod schemas in lib/ai.ts:
- ScoperOutput { milestones: { title, criteria: string[], amountUSD }[] }
- ReviewOutput { criteria: { name, pass: boolean, evidence }[],
  verdict: "PASS" | "FAIL", score: 0-100 integer }
- MediationOutput { turns: { speaker, message }[],
  proposedReleasePercent: 0-100 integer, rationale }

## 7. Screens and owners

- core: schema, lib/*, lib/types.ts, components/status-badge.tsx,
  components/role-switcher.tsx, app/layout.tsx with the top bar.
- money: the money routes in section 6.
- ai: the AI and data routes in section 6.
- deal-ui: /deals/[id], components/deal/**, prisma/seed.ts (deal id "demo",
  3 milestones in DRAFT, FUNDED, REVIEWED; seeded rows have no PayPal ids).
- dispute-ui: /deals/[id]/dispute/[milestoneId], components/dispute/**.
- new-deal-dash-landing: /, /deals/new, /dashboard, components/dashboard/**.

Existing code to migrate in place, not duplicate: the routes under app/api
(paypal, milestones/[id]/approve, milestones/[id]/void, webhooks, health,
ai/scope), lib/demo-deal.ts, lib/status.ts and components/deal/deal-view.tsx
still use the old status values (PENDING, FUNDED, RELEASED, ...). Their
owners rewrite them to this specification. The old /release, /review and
/mediate routes are gone and must not come back.

## 8. Addendum (overrides earlier sections where they differ)

Ownership:
- core also owns lib/status.ts, lib/demo-deal.ts, next.config.ts, the Prisma
  schema and lib/types.ts.
- money owns all PayPal and payment lifecycle code.
- deal-ui owns the deal page AND the dispute page
  (app/deals/[id]/**, components/deal/**, components/dispute/**, seed).
- new-deal-dash-landing owns /, /deals/new, /dashboard.

Requirements:
1. Old status values (PENDING, RELEASE_PENDING, PARTIALLY_RELEASED and the
   HELD_STATUSES list) are migrated everywhere to the section 4 values. No
   file may mention an old value when the work is finished.
2. AI code never captures, voids or releases money. app/api/ai/** and the
   submit and dispute routes must not import lib/paypal.ts.
3. No duplicate captures: claim-before-capture (section 5.3) plus
   PayPal-Request-Id. No duplicate submissions: submit claims the row with
   updateMany guarded by status FUNDED or REVIEWED; a second concurrent
   submit gets 409. Resubmitting the same URL while SUBMITTED is 409.
4. Any payment action on a milestone without a valid PayPal authorization
   (authorizationId null) returns 409 and does not call PayPal.
5. Demo data is kept separate from real payments: Deal has
   `isDemo Boolean @default(false)`. The seed sets isDemo true. Seeded FUNDED
   and REVIEWED milestones carry heldAmount for display but no PayPal ids.
   DealDTO and MilestoneDTO expose isDemo. The dashboard stat tiles count
   only non-demo deals and demo rows are tagged "Demo" in the table. Payment
   routes return 409 "Demo milestone: no PayPal authorization" for them.
6. Partial capture is NOT assumed to void the remainder. lib/paypal.ts gains
   getAuthorization(authId) (PaymentsController.getAuthorizedPayment, verified
   in the SDK types; returns status CREATED | CAPTURED | DENIED |
   PARTIALLY_CAPTURED | VOIDED | PENDING). Settlement capture runs only when
   env SETTLEMENT_CAPTURE_ENABLED is "true". When it is not, the accept route
   still records both acceptances, sets Mediation status to
   "ACCEPTED_BY_BOTH" (new value), leaves the milestone DISPUTED, moves no
   money and returns settled false with `pendingReason`. When enabled, after
   the capture the route calls getAuthorization and stores the authorization
   status in the SETTLED event payload as `authorizationStatusAfterCapture`;
   refundedAmount is recorded only if that status is VOIDED or CAPTURED,
   otherwise the event is logged with `remainderUnconfirmed: true`.
   AcceptSettlementResponse gains pendingReason?: string.
7. Run `npx tsc --noEmit` and `npm run build` after each stage.
8. No git commit, no git push.

core must leave the project passing tsc and build. Where the schema change
breaks a file another agent owns, core makes the smallest mechanical edit
that compiles (renamed field, migrated status value) and lists it in its
report; the owner rewrites the file later.
