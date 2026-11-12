"use client";

import { Building2, CodeXml } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ROLE_COOKIE, ROLE_COOKIE_MAX_AGE, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { role: Role; label: string; icon: typeof Building2 }[] = [
  { role: "CLIENT", label: "Client", icon: Building2 },
  { role: "FREELANCER", label: "Freelancer", icon: CodeXml },
];

function writeRoleCookie(role: Role) {
  document.cookie = `${ROLE_COOKIE}=${role}; path=/; max-age=${ROLE_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Segmented "Client | Freelancer" control. There is no auth: the choice is
 * stored in the settle_role cookie and server components re-render with it,
 * so every route shows the content for the selected role.
 */
export function RoleSwitcher({ initialRole }: { initialRole: Role }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);
  const [pending, startTransition] = useTransition();

  function choose(next: Role) {
    if (next === role) return;
    writeRoleCookie(next);
    setRole(next);
    // Pages show a skeleton until the server re-renders for the new role.
    window.dispatchEvent(new CustomEvent<Role>("settle:role", { detail: next }));
    toast(next === "CLIENT" ? "Viewing as client" : "Viewing as freelancer");
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="tablist"
      aria-label="Viewing as"
      aria-busy={pending}
      className="flex rounded-[9px] border border-line bg-chip p-[3px]"
    >
      {OPTIONS.map(({ role: r, label, icon: Icon }) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={role === r}
          title={label}
          onClick={() => choose(r)}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] font-medium transition-colors",
            role === r ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
          <span className="max-[719px]:hidden">{label}</span>
        </button>
      ))}
    </div>
  );
}
