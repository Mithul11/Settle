"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { DEMO_DEAL_ID } from "@/lib/demo-deal";

const LINKS = [
  ["#how", "How it works"],
  ["#ai", "AI review"],
  ["#disputes", "Disputes"],
  ["#payments", "Payments"],
] as const;

/** Frosted sticky header: hairline + shadow after 8px, emerald→blue scroll progress bar. */
export function LandingHeader() {
  const [menu, setMenu] = useState(false);
  const header = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, y / max)})`;
        if (header.current) header.current.style.boxShadow = y > 8 ? "0 1px 0 var(--line), 0 12px 32px -16px oklch(0 0 0 / 0.5)" : "none";
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const text = "text-[17px] font-medium whitespace-nowrap text-foreground opacity-[.86] transition-[color,opacity] hover:text-em hover:opacity-100";
  return (
    <header
      ref={header}
      className="sticky top-0 z-30 bg-[color-mix(in_oklch,var(--bg)_62%,transparent)] backdrop-blur-[22px] backdrop-saturate-[1.4] transition-shadow duration-300"
    >
      <div className="mx-auto flex h-[clamp(68px,8vw,96px)] max-w-[1440px] items-center gap-[clamp(16px,3vw,40px)] px-[clamp(16px,3vw,40px)]">
        <Link href="/" aria-label="Settle home" className="flex flex-none items-center gap-2.5 text-foreground hover:text-foreground">
          <Logo size={30} />
          <span className="text-[clamp(22px,2.2vw,30px)] leading-none font-bold tracking-[-0.045em]">settle</span>
        </Link>
        <nav aria-label="Primary" className="hidden min-w-0 flex-1 items-center justify-center gap-[clamp(8px,2.4vw,44px)] min-[1200px]:flex">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className={`${text} px-1 py-2`}>{label}</a>
          ))}
        </nav>
        <div className="ml-auto flex flex-none items-center gap-[clamp(8px,2vw,32px)]">
          <ThemeToggle className="rounded-full" />
          <Link href="/dashboard" className={`${text} hidden px-1 py-2 min-[1024px]:inline`}>Sign in</Link>
          <Link href={`/deals/${DEMO_DEAL_ID}`} className={`${text} hidden px-1 py-2 min-[1024px]:inline`}>Explore demo</Link>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-label="Menu"
            aria-expanded={menu}
            className="grid size-11 flex-none place-items-center rounded-full border border-line2 min-[1200px]:hidden"
          >
            {menu ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
          </button>
          <Link
            href="/deals/new"
            className="flex h-[clamp(44px,5vw,60px)] flex-none items-center rounded-full bg-foreground px-[clamp(18px,2.2vw,36px)] text-[clamp(15px,1.3vw,18px)] font-semibold whitespace-nowrap text-background transition-[transform,box-shadow,background,color] duration-200 hover:-translate-y-px hover:bg-em hover:text-on-em hover:shadow-[0_12px_30px_-12px_var(--em)]"
          >
            Create a deal
          </Link>
        </div>
      </div>
      {menu && (
        <nav aria-label="Menu" className="flex animate-fade-up flex-col border-t border-line px-[clamp(16px,3vw,40px)] pt-2 pb-4 min-[1200px]:hidden">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenu(false)} className="border-b border-line py-3.5 text-[17px] font-medium text-foreground hover:text-em">
              {label}
            </a>
          ))}
          <Link href="/dashboard" className="border-b border-line py-3.5 text-[17px] font-medium text-foreground">Sign in</Link>
          <Link href={`/deals/${DEMO_DEAL_ID}`} className="py-3.5 text-[17px] font-medium text-foreground">Explore demo</Link>
        </nav>
      )}
      <div ref={bar} className="absolute -bottom-px left-0 h-0.5 w-full origin-left scale-x-0 bg-gradient-to-r from-em to-blue" />
    </header>
  );
}
