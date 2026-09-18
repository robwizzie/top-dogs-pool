"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft, LogOut, Moon, ShieldCheck, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { RACK_NAV, RACK_THEME_STORAGE_KEY } from "@/lib/rack/config";
import { useRackSession, type RackSession } from "@/lib/rack/hooks/useRackSession";
import { Avatar, Button, RackLogo, Wordmark } from "./ui";

/**
 * One session subscription for the whole section, shared by context. Each
 * screen in the original called `getSession()` and re-fetched the profile on
 * mount, so moving between them re-queried the same two rows every time and
 * briefly rendered a signed-out shell.
 */
const SessionContext = createContext<RackSession | null>(null);

export function useSession(): RackSession {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <RackShell>");
  return ctx;
}

type Theme = "light" | "dark";

function useRackTheme(): [Theme | null, () => void] {
  // Null until mounted: the server can't know the saved choice, and the
  // inline bootstrap in the layout has already applied it to the DOM. Starting
  // at null keeps the button from rendering the wrong icon for one frame.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-rack]");
    const explicit = root?.getAttribute("data-rack-theme") as Theme | null;
    if (explicit === "light" || explicit === "dark") {
      setTheme(explicit);
      return;
    }
    setTheme(
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    );
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const root = document.querySelector<HTMLElement>("[data-rack]");
    root?.setAttribute("data-rack-theme", next);
    try {
      localStorage.setItem(RACK_THEME_STORAGE_KEY, next);
    } catch {
      /* private mode — the choice just won't persist */
    }
  }, [theme]);

  return [theme, toggle];
}

export function RackShell({ children }: { children: ReactNode }) {
  const session = useRackSession();
  const pathname = usePathname();
  const [theme, toggleTheme] = useRackTheme();

  return (
    <SessionContext.Provider value={session}>
      <div className="min-h-[70vh]">
        <header className="sticky top-0 z-30 border-b border-[hsl(var(--rack-border))] bg-[hsl(var(--rack-surface)/0.88)] backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <Link
              href="/rack"
              className="flex items-center gap-2.5"
              aria-label="Rack Up home"
            >
              <RackLogo size={38} priority />
              <Wordmark size="md" className="hidden sm:inline" />
            </Link>

            <nav className="ml-auto flex items-center gap-1">
              {/* Admins get one extra destination. Nobody else is shown it —
                  the page refuses non-admins anyway, but an unreachable link
                  is just clutter. */}
              {(session.profile?.is_admin
                ? [...RACK_NAV, { href: "/rack/admin", label: "Admin" }]
                : RACK_NAV
              ).map((item) => {
                const active =
                  item.href === "/rack"
                    ? pathname === "/rack"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-[var(--rack-radius)] px-3 py-2 font-[family-name:var(--rack-font-heading)] text-sm font-semibold transition",
                      active
                        ? "bg-[hsl(var(--rack-primary))] text-[hsl(var(--rack-primary-fg))]"
                        : "text-[hsl(var(--rack-fg-muted))] hover:bg-[hsl(var(--rack-fg)/0.06)] hover:text-[hsl(var(--rack-fg))]",
                    )}
                  >
                    {item.href === "/rack/admin" && (
                      <ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                    )}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-1 border-l border-[hsl(var(--rack-border))] pl-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
                title={theme === "dark" ? "Switch to light" : "Switch to dark"}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>

              {session.profile && (
                <Link
                  href="/rack/profile"
                  className="flex items-center gap-2 rounded-full p-1 hover:bg-[hsl(var(--rack-fg)/0.06)]"
                  title={session.profile.name}
                >
                  <Avatar
                    name={session.profile.name}
                    url={session.profile.avatar_url}
                    size={30}
                  />
                </Link>
              )}
              {session.user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void session.signOut()}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </header>

        {children}

        <footer className="mt-12 border-t border-[hsl(var(--rack-border))] py-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-[hsl(var(--rack-fg-muted))] sm:px-6">
            <span className="flex items-center gap-2">
              <Wordmark size="sm" />
              <span className="text-xs">part of Poolmaxxing</span>
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 hover:text-[hsl(var(--rack-fg))]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to the team site
            </Link>
          </div>
        </footer>
      </div>
    </SessionContext.Provider>
  );
}
