"use client";

import { useRouter } from "next/navigation";

const STORAGE_KEY = "topdogs:session-scope";

/**
 * Reset action for the SessionPicker. Clears the persisted session scope
 * from localStorage AND navigates to the no-param URL — without the
 * localStorage clear, SessionScopeMemory would restore the previous "all"
 * (or whatever was last picked) on the very next render, making Reset
 * appear to do nothing.
 */
export function ResetSessionScope({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore — private mode etc. */
        }
        router.push(href);
      }}
    >
      {children}
    </a>
  );
}
