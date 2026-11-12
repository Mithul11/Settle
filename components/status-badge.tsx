import {
  Ban,
  CircleCheck,
  CircleDashed,
  Handshake,
  Lock,
  ScanSearch,
  Send,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { STATUS_LABEL } from "@/lib/status";
import { isMilestoneStatus, type MilestoneStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLE: Record<MilestoneStatus, { icon: LucideIcon; className: string }> = {
  DRAFT: { icon: CircleDashed, className: "bg-chip text-muted-foreground" },
  FUNDED: { icon: Lock, className: "bg-amber-soft text-amber" },
  SUBMITTED: { icon: Send, className: "bg-blue-soft text-blue" },
  REVIEWED: { icon: ScanSearch, className: "bg-violet-soft text-violet" },
  RELEASED: { icon: CircleCheck, className: "bg-em-soft text-em" },
  DISPUTED: { icon: TriangleAlert, className: "bg-red-soft text-red" },
  SETTLED: { icon: Handshake, className: "bg-teal-soft text-teal" },
  VOIDED: { icon: Ban, className: "bg-slate-soft text-slate" },
};

/** Milestone status as a pill with an icon and a text label. */
export function StatusBadge({
  status,
  className,
}: {
  status: MilestoneStatus | string;
  className?: string;
}) {
  const known = isMilestoneStatus(status);
  const { icon: Icon, className: tone } = known ? STYLE[status] : STYLE.DRAFT;
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {known ? STATUS_LABEL[status] : status}
    </span>
  );
}
