"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { RACK_NAV } from "@/lib/rack/config";
import { useRackSession, type RackSession } from "@/lib/rack/hooks/useRackSession";
import { Avatar, Button } from "./ui";

/**
 * One session subscription for the whole section, shared by context. Each
 * screen in the old app called `supabase.auth.getSession()` and re-fetched the
 * profile on mount, so navigating between them re-queried the same two rows
 * every time and briefly rendered a signed-out shell.
 */
const SessionContext = createContext<RackSession | null>(null);

export function useSession(): RackSession {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <RackShell>");
  return ctx;
}

export function RackShell({ children }: { children: ReactNode }) {
  const session = useRackSession();
  const pathname = usePathname();

  return (
    <SessionContext.Provider value={session}>
      <div className="min-h-[60vh]">
        <div className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
            {RACK_NAV.map((item) => {
              const active =
                item.href === "/rack"
                  ? pathname === "/rack"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition",
                    active
                      ? "bg-[var(--color-brass)] text-[var(--color-ink)]"
                      : "text-[var(--fg-dim)] hover:bg-white/5 hover:text-[var(--fg)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {session.profile && (
                <Link
                  href="/rack/profile"
                  className="flex items-center gap-2 text-sm text-[var(--fg-dim)] hover:text-[var(--fg)]"
                >
                  <Avatar
                    name={session.profile.name}
                    url={session.profile.avatar_url}
                    size={28}
                  />
                  <span className="hidden sm:inline">{session.profile.name}</span>
                </Link>
              )}
              {session.user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void session.signOut()}
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {children}
      </div>
    </SessionContext.Provider>
  );
}
