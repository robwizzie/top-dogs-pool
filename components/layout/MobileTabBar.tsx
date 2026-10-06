"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Beaker, Calendar, Home, Radio, ShoppingBag, Trophy, Users } from "lucide-react";
import { LiveDot } from "@/components/live/LiveCTA";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/roster", label: "Roster", icon: Users },
  { href: "/leaderboard", label: "Patches", icon: Trophy },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/store", label: "Shop", icon: ShoppingBag },
];

void Calendar;
void Beaker;

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 rounded-full border border-[var(--color-brass)]/20 bg-[color-mix(in_oklab,#0b0d0b_78%,transparent)] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-1.5 py-1.5">
        {TABS.map((t) => {
          const active = pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href));
          const Icon = t.icon;
          return (
            <li key={t.href} className="contents">
              <Link
                href={t.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] font-medium tracking-wide transition-colors",
                  active
                    ? "bg-[var(--color-brass)]/12 text-[var(--color-brass-bright)]"
                    : "text-[var(--color-cream)]/60",
                )}
              >
                <span className="relative">
                  <Icon size={20} />
                  {t.href === "/live" && (
                    <LiveDot className="absolute -right-1 -top-1" />
                  )}
                </span>
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
