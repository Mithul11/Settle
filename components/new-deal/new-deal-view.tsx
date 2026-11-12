"use client";

import { Check, Circle, CircleCheck, Copy, Link2, ListChecks, LoaderCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Shimmer, Spinner } from "@/components/app/ui";
import { PageTitle } from "@/components/shell/page-title";
import type { CreateDealRequest, CreateDealResponse, ScopeResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmt, postJSON } from "@/lib/view";

type Form = { title: string; client: string; email: string; desc: string };
type Draft = { key: number; title: string; criteria: string; amount: string };

const STEPS = ["Reading project description", "Identifying deliverables", "Drafting acceptance criteria", "Pricing milestones"];
const EXAMPLE: Form = {
  title: "Ledgerline invoicing app",
  client: "Northwind Studio",
  email: "maya@northwind.studio",
  desc: "A web app for small studios to create, send and track invoices. Needs sign-in, an invoice builder with tax and discounts, PDF export, and PayPal payments with status updates.",
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("flex flex-col gap-1.5", wide && "col-span-full")}>
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {error && <span className="text-[12px] text-red">{error}</span>}
    </label>
  );
}

export function NewDealView() {
  const [form, setForm] = useState<Form>({ title: "", client: "", email: "", desc: "" });
  const [err, setErr] = useState<Partial<Form>>({});
  const [scoping, setScoping] = useState(false);
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; url: string } | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    if (!scoping) return;
    // The step lines tick while the scoper request runs; milestones only come from the API.
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, [scoping]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErr((x) => ({ ...x, [k]: undefined }));
  };

  function validate() {
    const e: Partial<Form> = {};
    if (!form.title.trim()) e.title = "Add a project title";
    if (!form.client.trim()) e.client = "Add the client name";
    if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid email";
    if (form.desc.trim().length < 30) e.desc = "Describe the project in at least 30 characters so the scoper has enough context";
    setErr(e);
    return Object.keys(e).length === 0;
  }

  async function scope() {
    if (!validate()) return;
    setStep(0);
    setScoping(true);
    setSaved(null);
    try {
      const res = await postJSON<ScopeResponse>("/api/ai/scope", { title: form.title.trim(), brief: form.desc.trim() });
      setDrafts(
        res.milestones.map((m) => ({
          key: ++keyRef.current,
          title: m.title,
          criteria: m.criteria.join("\n"),
          amount: String(m.amountUSD),
        })),
      );
      toast.success(`AI Scoper drafted ${res.milestones.length} milestones`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The AI Scoper failed");
    } finally {
      setScoping(false);
    }
  }

  const update = (key: number, patch: Partial<Draft>) => setDrafts((ds) => ds?.map((d) => (d.key === key ? { ...d, ...patch } : d)) ?? null);
  const add = () => setDrafts((ds) => [...(ds ?? []), { key: ++keyRef.current, title: "", criteria: "", amount: "" }]);
  const remove = (key: number) => setDrafts((ds) => ds?.filter((d) => d.key !== key) ?? null);

  async function save() {
    if (!validate()) return;
    const list = drafts ?? [];
    const criteria = (d: Draft) => d.criteria.split("\n").map((c) => c.trim()).filter(Boolean);
    if (!list.length || list.some((d) => !d.title.trim() || !(parseFloat(d.amount) > 0) || criteria(d).length === 0)) {
      toast.error("Each milestone needs a title, an amount and at least one criterion");
      return;
    }
    setSaving(true);
    try {
      const body: CreateDealRequest = {
        title: form.title.trim(),
        brief: form.desc.trim(),
        clientName: form.client.trim(),
        clientEmail: form.email.trim(),
        milestones: list.map((d) => ({ title: d.title.trim(), criteria: criteria(d), amountUSD: Math.round(parseFloat(d.amount) * 100) / 100 })),
      };
      const { id } = await postJSON<CreateDealResponse>("/api/deals", body);
      setSaved({ id, url: `${window.location.origin}/deals/${id}` });
      toast.success("Deal saved. Share the link with your client.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the deal");
    } finally {
      setSaving(false);
    }
  }

  const total = (drafts ?? []).reduce((a, d) => a + (parseFloat(d.amount) || 0), 0);
  const count = (drafts ?? []).length;
  const border = (k: keyof Form) => (err[k] ? "border-red" : "border-line2");

  return (
    <div className="flex flex-wrap items-start gap-5">
      <PageTitle title="New deal" sub="Describe the work and let the AI Scoper draft milestones" />
      <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-4">
        <section className="flex flex-col gap-[18px] rounded-xl border border-line bg-surface p-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-6 place-items-center rounded-md bg-chip font-mono text-[12px]">1</span>
            <span className="font-semibold">Project details</span>
            <button
              type="button"
              onClick={() => {
                setForm(EXAMPLE);
                setErr({});
              }}
              className="ml-auto h-8 rounded-[7px] border border-line px-2.5 text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              Use example
            </button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3.5">
            <Field label="Project title" error={err.title} wide>
              <input value={form.title} onChange={set("title")} placeholder="e.g. Invoicing web app" className={cn("field", border("title"))} />
            </Field>
            <Field label="Client name" error={err.client}>
              <input value={form.client} onChange={set("client")} placeholder="Company or person" className={cn("field", border("client"))} />
            </Field>
            <Field label="Client email" error={err.email}>
              <input type="email" value={form.email} onChange={set("email")} placeholder="name@company.com" className={cn("field", border("email"))} />
            </Field>
            <Field label="Project description" error={err.desc} wide>
              <textarea
                value={form.desc}
                onChange={set("desc")}
                rows={5}
                placeholder="What are you building, and what does done look like?"
                className={cn("resize-y rounded-[9px] border bg-background p-3 outline-none", border("desc"))}
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={scope}
            disabled={scoping}
            className="flex h-[46px] items-center gap-2.5 self-start rounded-[10px] border border-blue bg-gradient-to-br from-blue-soft to-em-soft px-[18px] font-semibold transition-transform hover:-translate-y-px disabled:opacity-70"
          >
            {scoping ? <Spinner className="text-blue" /> : <Sparkles className="size-4 text-blue" />}
            {drafts ? "Regenerate milestones" : "Generate milestones with AI"}
          </button>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-6 place-items-center rounded-md bg-chip font-mono text-[12px]">2</span>
            <span className="font-semibold">Milestones</span>
            {count > 0 && <span className="text-[12px] text-faint">{count} milestones</span>}
          </div>

          {scoping && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-2.5 rounded-[10px] border border-blue bg-blue-soft p-4">
                <span className="flex items-center gap-2 font-semibold">
                  <Sparkles className="size-4 animate-soft-pulse text-blue" />
                  AI Scoper is working
                </span>
                {STEPS.map((s, i) => (
                  <span key={s} className={cn("flex items-center gap-2.5 text-[13px]", i <= step ? "text-foreground" : "text-faint")}>
                    {i < step ? (
                      <Check className="size-4 text-em" />
                    ) : i === step ? (
                      <LoaderCircle className="size-4 animate-spin text-blue" />
                    ) : (
                      <Circle className="size-4 text-faint" />
                    )}
                    {s}
                  </span>
                ))}
              </div>
              <Shimmer className="h-24 rounded-[10px]" />
              <Shimmer className="h-24 rounded-[10px] opacity-70" />
            </div>
          )}

          {!scoping && count === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-line2 px-5 py-9 text-center">
              <ListChecks className="size-[22px] text-faint" />
              <span className="font-medium">No milestones yet</span>
              <span className="max-w-[360px] text-[13px] text-muted-foreground">Run the AI Scoper to draft milestones from your description, or add them manually.</span>
              <button type="button" onClick={add} className="mt-1.5 flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-background px-3.5 font-medium">
                <Plus className="size-4" />
                Add manually
              </button>
            </div>
          )}

          {!scoping && count > 0 && (
            <div className="flex flex-col gap-3">
              {drafts!.map((d, i) => {
                const n = d.criteria.split("\n").filter((c) => c.trim()).length;
                return (
                  <div key={d.key} className="flex animate-fade-up flex-col gap-3 rounded-[10px] border border-line2 bg-background p-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-[12px] text-faint">M{i + 1}</span>
                      <input
                        value={d.title}
                        onChange={(e) => update(d.key, { title: e.target.value })}
                        placeholder="Milestone title"
                        aria-label="Milestone title"
                        className="h-10 min-w-0 flex-[1_1_200px] rounded-lg border border-line bg-surface px-2.5 font-semibold outline-none"
                      />
                      <label className="flex h-10 w-[130px] items-center gap-1 rounded-lg border border-line bg-surface px-2.5">
                        <span className="text-faint">$</span>
                        <input
                          value={d.amount}
                          onChange={(e) => update(d.key, { amount: e.target.value.replace(/[^\d.]/g, "") })}
                          inputMode="decimal"
                          aria-label="Amount"
                          className="w-full border-0 bg-transparent font-mono outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => remove(d.key)}
                        aria-label="Remove milestone"
                        className="grid size-10 place-items-center rounded-lg border border-line text-muted-foreground hover:border-red hover:text-red"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] text-muted-foreground">Acceptance criteria · one per line · {n} criteria</span>
                      <textarea
                        value={d.criteria}
                        onChange={(e) => update(d.key, { criteria: e.target.value })}
                        rows={4}
                        className="resize-y rounded-lg border border-line bg-surface p-2.5 text-[13px] leading-[1.6] outline-none"
                      />
                    </label>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={add}
                className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dashed border-line2 font-medium text-muted-foreground hover:border-em hover:text-foreground"
              >
                <Plus className="size-4" />
                Add milestone
              </button>
            </div>
          )}
        </section>
      </div>

      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 min-[900px]:sticky min-[900px]:top-[88px]">
        <div className="flex flex-col gap-3.5 rounded-xl border border-line bg-surface p-5">
          <span className="text-[13px] text-muted-foreground">Total deal value</span>
          <span className="text-[34px] font-semibold tracking-[-0.03em] tabular-nums">{fmt(total)}</span>
          <div className="flex flex-col gap-2 border-t border-line pt-3 text-[13px] text-muted-foreground">
            <span className="flex justify-between"><span>Milestones</span><span className="text-foreground">{count} milestones</span></span>
            <span className="flex justify-between gap-3"><span>Client</span><span className="truncate text-foreground">{form.client || "—"}</span></span>
            <span className="flex justify-between"><span>Payment</span><span className="text-foreground">PayPal, per milestone</span></span>
          </div>
          <button type="button" onClick={save} disabled={saving} className="btn-em h-[46px]">
            {saving ? (
              <>
                <Spinner />
                Saving deal
              </>
            ) : (
              <>
                <Link2 className="size-4" />
                Save and generate link
              </>
            )}
          </button>
        </div>
        {saved && (
          <div className="flex animate-fade-up flex-col gap-2.5 rounded-xl border border-em bg-em-soft p-[18px]">
            <span className="flex items-center gap-2 font-semibold text-em">
              <CircleCheck className="size-4" />
              Deal saved
            </span>
            <span className="text-[13px] text-muted-foreground">Send this link to {form.client}. They review the milestones and fund the first one.</span>
            <div className="flex gap-2">
              <span className="flex h-10 min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-line bg-background px-2.5 font-mono text-[12.5px] text-ellipsis whitespace-nowrap">
                {saved.url.replace(/^https?:\/\//, "")}
              </span>
              <button
                type="button"
                aria-label="Copy link"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(saved.url);
                    toast("Link copied");
                  } catch {
                    toast.error("Copy failed. Select the link and copy it.");
                  }
                }}
                className="grid size-10 place-items-center rounded-lg border border-line2 bg-background"
              >
                <Copy className="size-4" />
              </button>
            </div>
            <Link href={`/deals/${saved.id}`} className="btn-line h-10 text-foreground hover:text-foreground">
              Open deal
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
