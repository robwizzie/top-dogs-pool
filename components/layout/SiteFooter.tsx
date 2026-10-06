import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { TIKTOK_PROFILE_URL } from "@/lib/config";

const COLUMNS = [
  {
    title: "Season",
    links: [
      { href: "/schedule", label: "Schedule" },
      { href: "/standings", label: "Standings" },
      { href: "/roster", label: "Roster" },
      { href: "/leaderboard", label: "Patch Watch" },
    ],
  },
  {
    title: "Training",
    links: [
      { href: "/shots", label: "Shot catalog" },
      { href: "/dawg-drill", label: "Dawg Drill" },
      { href: "/stats", label: "Practice stats" },
      { href: "/glossary", label: "Glossary" },
    ],
  },
  {
    title: "Elsewhere",
    links: [
      { href: "/live", label: "Live" },
      { href: "/store", label: "Shop" },
      { href: TIKTOK_PROFILE_URL, label: "TikTok", external: true },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative mt-12 overflow-hidden border-t border-[var(--color-brass)]/15 pb-[max(2rem,calc(env(safe-area-inset-bottom)+6rem))] md:pb-10">
      {/* felt glow rising from the bottom edge */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[420px] bg-[radial-gradient(60%_80%_at_50%_100%,rgba(46,139,87,0.22),transparent_70%)]"
        aria-hidden
      />
      <div className="brass-rule h-px opacity-60" />

      <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.2fr_2fr]">
          <div>
            <div className="flex items-center gap-4">
              <Logo size={64} className="hover-roll" />
              <p className="pm-serif text-2xl leading-tight text-[var(--color-cream)]/85">
                Rack &apos;em,
                <br />
                <span className="text-[var(--color-brass-bright)]">run &apos;em.</span>
              </p>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-[var(--color-cream)]/55">
              An APA 8-ball team out of South Jersey. Stats pulled live from the
              APA every week.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-3" aria-label="Footer">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                  {col.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      {"external" in l ? (
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--color-cream)]/70 transition-colors hover:text-[var(--color-brass-bright)]"
                        >
                          {l.label} ↗
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          className="text-sm text-[var(--color-cream)]/70 transition-colors hover:text-[var(--color-brass-bright)]"
                        >
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Oversized sign-off wordmark, cropped by the bottom edge */}
        <p
          aria-hidden
          className="pm-outline mt-16 select-none whitespace-nowrap text-center font-[family-name:var(--font-display)] text-[clamp(4.5rem,19vw,17rem)] leading-[0.8] opacity-[0.16] [-webkit-text-stroke-width:1px]"
        >
          TOP DAWGS
        </p>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-[var(--color-cream)]/[0.07] pt-6 text-xs text-[var(--color-cream)]/40 sm:flex-row md:pr-36">
          <p>© {new Date().getFullYear()} Top Dawgs · Poolmaxxing</p>
          <p>Stats live from APA</p>
        </div>
      </div>
    </footer>
  );
}
