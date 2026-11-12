import {
  Banknote,
  CircleCheck,
  FolderGit2,
  Scale,
  ScanSearch,
  TriangleAlert,
  Undo2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { TIMELINE, TONE, type TimelineType } from "@/lib/view";
import { cn } from "@/lib/utils";

export const TIMELINE_ICON: Record<TimelineType, LucideIcon> = {
  authorization: Wallet,
  capture: Banknote,
  void: Undo2,
  ai_review: ScanSearch,
  submission: FolderGit2,
  approval: CircleCheck,
  dispute: TriangleAlert,
  settlement: Scale,
};

/** Rounded icon tile tinted by the event type's tone. */
export function TimelineTile({ type, size = 32 }: { type: TimelineType; size?: number }) {
  const Icon = TIMELINE_ICON[type];
  const tone = TONE[TIMELINE[type].tone];
  return (
    <span
      className={cn("grid flex-none place-items-center rounded-[9px]", tone.fg, tone.bg)}
      style={{ width: size, height: size }}
    >
      <Icon className="size-[15px]" />
    </span>
  );
}
