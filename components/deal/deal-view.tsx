"use client";

import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type MilestoneView = {
  id: string;
  title: string;
  criteria: string[];
  amount: string;
  status: string;
  capturedAmount: string | null;
};

type Role = "client" | "freelancer";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Awaiting funding", className: "bg-muted text-muted-foreground" },
  FUNDED: { label: "Funded (held)", className: "bg-blue-100 text-blue-900" },
  SUBMITTED: { label: "Submitted", className: "bg-violet-100 text-violet-900" },
  DISPUTED: { label: "Disputed", className: "bg-amber-100 text-amber-900" },
  RELEASE_PENDING: { label: "Release pending", className: "bg-amber-100 text-amber-900" },
  RELEASED: { label: "Released", className: "bg-emerald-100 text-emerald-900" },
  PARTIALLY_RELEASED: { label: "Partially released", className: "bg-emerald-100 text-emerald-900" },
  VOIDED: { label: "Voided", className: "bg-red-100 text-red-900" },
};

const HELD = ["FUNDED", "SUBMITTED", "DISPUTED"];

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function DealView({
  milestones,
  paypalClientId,
}: {
  milestones: MilestoneView[];
  paypalClientId: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("client");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(milestone: MilestoneView, action: "release" | "void") {
    setBusyId(milestone.id);
    try {
      const { status } = await post<{ status: string }>(
        `/api/milestones/${milestone.id}/${action}`,
      );
      toast.success(
        action === "release"
          ? `Payment ${status === "RELEASED" ? "released" : "release is pending"}`
          : "Authorization voided, hold released",
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  const list = (
    <div className="mt-4 space-y-4">
      {milestones.map((m, index) => {
        const status = STATUS_STYLE[m.status] ?? {
          label: m.status,
          className: "bg-muted text-muted-foreground",
        };
        return (
          <Card key={m.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {index + 1}. {m.title}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    ${m.amount} USD
                    {m.capturedAmount && ` · $${m.capturedAmount} captured`}
                  </CardDescription>
                </div>
                <Badge className={status.className}>{status.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {m.criteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>

              {role === "client" && m.status === "PENDING" && (
                <div className="max-w-sm">
                  {paypalClientId ? (
                    <PayPalButtons
                      style={{ layout: "horizontal", tagline: false, height: 40 }}
                      forceReRender={[m.id, m.amount]}
                      createOrder={async () => {
                        const { orderId } = await post<{ orderId: string }>(
                          "/api/paypal/orders",
                          { milestoneId: m.id },
                        );
                        return orderId;
                      }}
                      onApprove={async (data) => {
                        await post(`/api/paypal/orders/${data.orderID}/authorize`);
                        toast.success("Milestone funded. PayPal is holding the money.");
                        router.refresh();
                      }}
                      onError={(error) => {
                        toast.error(
                          error instanceof Error ? error.message : "PayPal error",
                        );
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Set PAYPAL_CLIENT_ID in .env to enable the PayPal button.
                    </p>
                  )}
                </div>
              )}

              {role === "client" && HELD.includes(m.status) && (
                <div className="flex gap-2">
                  <Button disabled={busyId === m.id} onClick={() => act(m, "release")}>
                    Release ${m.amount}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busyId === m.id}
                    onClick={() => act(m, "void")}
                  >
                    Void hold
                  </Button>
                </div>
              )}

              {role === "freelancer" && (
                <p className="text-sm text-muted-foreground">
                  {m.status === "PENDING" && "Waiting for the client to fund this milestone."}
                  {HELD.includes(m.status) &&
                    "Funds are held by PayPal. Deliverable submission and AI review come next."}
                  {m.status === "RELEASED" && "Paid in full."}
                  {m.status === "VOIDED" && "The client hold was released. No payment."}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">View as</span>
        {(["client", "freelancer"] as const).map((r) => (
          <Button
            key={r}
            size="sm"
            variant={role === r ? "default" : "outline"}
            aria-pressed={role === r}
            onClick={() => setRole(r)}
          >
            {r === "client" ? "Client" : "Freelancer"}
          </Button>
        ))}
      </div>

      {paypalClientId ? (
        <PayPalScriptProvider
          options={{ clientId: paypalClientId, intent: "authorize", currency: "USD" }}
        >
          {list}
        </PayPalScriptProvider>
      ) : (
        list
      )}
    </section>
  );
}
