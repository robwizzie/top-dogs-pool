"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Beaker, Calendar, Home, Radio, Trophy, Users } from "lucide-react";
import { LiveDot } from "@/components/live/LiveCTA";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/roster", label: "Roster", icon: Users },
  { href: "/leaderboard", label: "Patch Watch", icon: Trophy },
  { href: "/research", label: "Research", icon: Beaker },
  { href: "/live", label: "Live", icon: Radio },
];

void Calendar;

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_92%,transparent)] backdrop-blur-md md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((t) => {
          const active = pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href));
          const Icon = t.icon;
          return (
            <li key={t.href} className="contents">
              <Link
                href={t.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-[11px] font-medium tracking-wide",
                  active
                    ? "text-[var(--color-brass-bright)]"
                    : "text-[var(--fg-dim)]",
                )}
              >
                <span className="relative">
                  <Icon size={20} />
                  {t.href === "/live" && (
                    <LiveDot className="absolute -right-1 -top-1" />
                  )}
                </span>
                <span>{t.label}</span>
                {active && (
                  <span className="block h-0.5 w-6 rounded-full bg-[var(--color-brass)]" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
