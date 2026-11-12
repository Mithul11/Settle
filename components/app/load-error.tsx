"use client";

import { CloudOff, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PageTitle } from "@/components/shell/page-title";
import { Spinner } from "@/components/app/ui";

/** Shown when DATABASE_URL is not set yet (no .env). */
export function SetupHint() {
  return (
    <span className="max-w-[460px] rounded-lg bg-chip px-3 py-2.5 text-[13px] text-muted-foreground">
      The database is not configured. Copy <code className="font-mono text-foreground">.env.example</code> to{" "}
      <code className="font-mono text-foreground">.env</code>, set <code className="font-mono text-foreground">DATABASE_URL</code>, run{" "}
      <code className="font-mono text-foreground">npx prisma migrate dev</code> and restart the dev server.
    </span>
  );
}

/** Error state with "Try again": shown when the database does not respond. */
export function LoadError({ what, setup }: { what: string; setup?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <>
      <PageTitle title="Something went wrong" />
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-12 text-center">
        <span className="grid size-11 place-items-center rounded-xl bg-red-soft text-red">
          <CloudOff className="size-5" />
        </span>
        <span className="text-[16px] font-semibold">Couldn’t load {what}</span>
        <span className="max-w-[420px] text-[13.5px] text-muted-foreground">
          The payment ledger didn’t respond. No authorizations or captures were changed.
        </span>
        {setup && <SetupHint />}
        <button type="button" onClick={() => start(() => router.refresh())} className="btn-line mt-1" disabled={pending}>
          {pending ? <Spinner /> : <RotateCcw className="size-4" />}
          Try again
        </button>
      </div>
    </>
  );
}
