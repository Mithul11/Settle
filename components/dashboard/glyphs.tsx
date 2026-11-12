import {
  ArrowUpRight,
  Banknote,
  ClipboardCheck,
  Lock,
  Scale,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
  Upload,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ActionIcon, KpiIcon } from "@/components/dashboard/data";

const MAP: Record<ActionIcon | KpiIcon | "view", LucideIcon> = {
  wallet: Wallet,
  "scan-search": ScanSearch,
  scale: Scale,
  upload: Upload,
  view: ArrowUpRight,
  lock: Lock,
  banknote: Banknote,
  "clipboard-check": ClipboardCheck,
  "triangle-alert": TriangleAlert,
  "shield-check": ShieldCheck,
};

export function ActionGlyph({ name, className = "size-3.5" }: { name: keyof typeof MAP; className?: string }) {
  const Icon = MAP[name];
  return <Icon className={className} />;
}
