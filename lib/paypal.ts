import {
  ApiError,
  CheckoutPaymentIntent,
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  PaypalExperienceUserAction,
  PaypalWalletContextShippingPreference,
  type CapturedPayment,
  type Order,
  type OrderAuthorizeResponse,
  type PaymentAuthorization,
} from "@paypal/paypal-server-sdk";

// Sandbox only. Settle never talks to the live PayPal API.
const SANDBOX_API_BASE = "https://api-m.sandbox.paypal.com";
const CURRENCY = "USD";

let cached:
  | { client: Client; orders: OrdersController; payments: PaymentsController }
  | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

// Created lazily so `next build` works without PayPal credentials.
function paypal() {
  if (!cached) {
    const client = new Client({
      environment: Environment.Sandbox,
      clientCredentialsAuthCredentials: {
        oAuthClientId: requireEnv("PAYPAL_CLIENT_ID"),
        oAuthClientSecret: requireEnv("PAYPAL_CLIENT_SECRET"),
      },
      timeout: 30_000,
    });
    cached = {
      client,
      orders: new OrdersController(client),
      payments: new PaymentsController(client),
    };
  }
  return cached;
}

/** Format a number or numeric string as a PayPal money value, e.g. "50.00". */
export function toMoneyValue(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  return n.toFixed(2);
}

/**
 * Create an order with intent AUTHORIZE. Approving and authorizing it places
 * a hold on the buyer funds without moving them.
 */
export async function createAuthorizeOrder(
  amount: number | string,
  description: string,
  opts: { customId?: string; requestId?: string } = {},
): Promise<Order> {
  const { result } = await paypal().orders.createOrder({
    body: {
      intent: CheckoutPaymentIntent.Authorize,
      purchaseUnits: [
        {
          amount: { currencyCode: CURRENCY, value: toMoneyValue(amount) },
          description: description.slice(0, 127),
          customId: opts.customId,
        },
      ],
      paymentSource: {
        paypal: {
          experienceContext: {
            brandName: "Settle",
            shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
            userAction: PaypalExperienceUserAction.PayNow,
          },
        },
      },
    },
    paypalRequestId: opts.requestId,
    prefer: "return=representation",
  });
  return result;
}

/** Authorize an approved order. This is the moment the funds are held. */
export async function authorizeOrder(
  orderId: string,
  requestId?: string,
): Promise<OrderAuthorizeResponse> {
  const { result } = await paypal().orders.authorizeOrder({
    id: orderId,
    paypalRequestId: requestId,
    prefer: "return=representation",
  });
  return result;
}

/**
 * Capture an authorization.
 * - No `amount`: capture the full authorized amount.
 * - `amount` with `finalCapture = true`: partial capture; PayPal voids the rest.
 */
export async function captureAuthorization(
  authId: string,
  amount?: number | string,
  finalCapture = true,
  requestId?: string,
): Promise<CapturedPayment> {
  const { result } = await paypal().payments.captureAuthorizedPayment({
    authorizationId: authId,
    paypalRequestId: requestId,
    prefer: "return=representation",
    body: {
      finalCapture,
      ...(amount !== undefined && {
        amount: { currencyCode: CURRENCY, value: toMoneyValue(amount) },
      }),
    },
  });
  return result;
}

/** Void an authorization and release the hold back to the buyer. */
export async function voidAuthorization(
  authId: string,
  requestId?: string,
): Promise<PaymentAuthorization | null> {
  const { result } = await paypal().payments.voidPayment({
    authorizationId: authId,
    paypalRequestId: requestId,
    prefer: "return=representation",
  });
  return result;
}

export async function getOrder(orderId: string): Promise<Order> {
  const { result } = await paypal().orders.getOrder({ id: orderId });
  return result;
}

/** First authorization on an order (Settle uses one purchase unit per order). */
export function firstAuthorization(order: OrderAuthorizeResponse | Order) {
  return order.purchaseUnits?.[0]?.payments?.authorizations?.[0];
}

/**
 * Verify a webhook with the PayPal verify-webhook-signature endpoint.
 * The server SDK has no webhooks controller, so this is a direct REST call
 * using an access token from the SDK auth manager.
 * `rawBody` must be the exact request body text: re-serialising it would
 * change the bytes PayPal signed.
 */
export async function verifyWebhookSignature(
  headers: Headers,
  rawBody: string,
): Promise<boolean> {
  const webhookId = requireEnv("PAYPAL_WEBHOOK_ID");

  const fields = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
  };
  if (Object.values(fields).some((v) => !v)) return false;

  try {
    JSON.parse(rawBody);
  } catch {
    return false;
  }

  const token = await paypal().client.clientCredentialsAuthManager.fetchToken();
  const head = JSON.stringify({ ...fields, webhook_id: webhookId });
  // Splice the raw event in untouched.
  const body = `${head.slice(0, -1)},"webhook_event":${rawBody}}`;

  const res = await fetch(
    `${SANDBOX_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.accessToken}`,
      },
      body,
      cache: "no-store",
    },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}

/** Turn an SDK error into something safe and useful to return or log. */
export function describePayPalError(error: unknown): {
  status: number;
  message: string;
  details?: unknown;
} {
  if (error instanceof ApiError) {
    let details: unknown = error.result;
    if (!details && typeof error.body === "string") {
      try {
        details = JSON.parse(error.body);
      } catch {
        details = error.body;
      }
    }
    return {
      status: error.statusCode,
      message: `PayPal API error (${error.statusCode})`,
      details,
    };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : "Unknown error",
  };
}
