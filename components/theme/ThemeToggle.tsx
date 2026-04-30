"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = theme !== "light";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] transition-colors hover:border-[var(--border-strong)]",
        className,
      )}
    >
      {mounted ? (
        isDark ? (
          <Sun size={16} className="text-[var(--color-brass)]" />
        ) : (
          <Moon size={16} className="text-[var(--color-felt)]" />
        )
      ) : (
        <span className="block h-4 w-4" />
      )}
    </button>
  );
}
