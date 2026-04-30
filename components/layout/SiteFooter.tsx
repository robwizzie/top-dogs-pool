import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { TIKTOK_PROFILE_URL } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--border)] pb-[max(2rem,calc(env(safe-area-inset-bottom)+5rem))] md:pb-12">
      <div className="brass-rule h-px" />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <LogoMark />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--fg-dim)]">
          <Link href="/schedule" className="hover:text-[var(--color-brass)]">Schedule</Link>
          <Link href="/roster" className="hover:text-[var(--color-brass)]">Roster</Link>
          <Link href="/standings" className="hover:text-[var(--color-brass)]">Standings</Link>
          <Link href="/leaderboard" className="hover:text-[var(--color-brass)]">Sweeps</Link>
          <a href={TIKTOK_PROFILE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-brass)]">TikTok</a>
        </div>
        <p className="text-xs text-[var(--fg-dim)]">
          © {new Date().getFullYear()} Top Dogs · Stats live from APA.
        </p>
      </div>
    </footer>
  );
}
