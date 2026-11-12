"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { parseTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

/** Switches [data-theme] on <html> and persists it in a cookie. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(
    subscribe,
    () => parseTheme(document.documentElement.dataset.theme),
    () => "dark" as Theme,
  );
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-chip hover:text-foreground",
        className,
      )}
    >
      <Icon className="size-[17px]" />
    </button>
  );
}
