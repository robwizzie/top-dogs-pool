import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { GLOSSARY, type GlossaryEntry } from "@/lib/kinister/glossary";

export const metadata = {
  title: "Glossary — Top Dogs Pool",
  description:
    "Definitions for the pool terms used throughout the shot catalog — english, draw, stun, ghost ball, tangent line, and more.",
};

const SECTION_ORDER: GlossaryEntry["category"][] = [
  "Stroke",
  "Geometry",
  "Position",
  "Table",
];

const SECTION_DESCRIPTIONS: Record<GlossaryEntry["category"], string> = {
  Stroke: "How the cue tip strikes the cue ball — spin, english, draw, follow.",
  Geometry: "How the cue ball, object ball, and pocket relate in space.",
  Position: "Controlling where the cue ball ends up after the shot.",
  Table: "Parts of the table and the rail references you'll sight off.",
};

export default function GlossaryPage() {
  return (
    <main className="min-h-dvh bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <Link
            href="/shots"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
          >
            <ArrowLeft size={14} />
            All Shots
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <BookOpen size={28} className="text-[var(--color-brass-bright)]" />
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-5xl">
              Glossary
            </h1>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fg-dim)]">
            The pool terms used in the technique notes, descriptions, and
            tips throughout the catalog. Open before diving into a new shot
            if a word in the brief doesn&apos;t click yet.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
        {SECTION_ORDER.map((section) => {
          const entries = GLOSSARY.filter((e) => e.category === section).sort(
            (a, b) => a.term.localeCompare(b.term),
          );
          if (entries.length === 0) return null;
          return (
            <section key={section} className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                  {section}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--fg-dim)]">
                  {SECTION_DESCRIPTIONS[section]}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {entries.map((e) => (
                  <article
                    key={e.term}
                    className="surface flex flex-col gap-2 p-4"
                  >
                    <header className="flex flex-wrap items-baseline gap-2">
                      <h2 className="font-[family-name:var(--font-display)] text-lg tracking-wide text-[var(--fg)]">
                        {e.term}
                      </h2>
                      {e.aliases && e.aliases.length > 0 && (
                        <span className="text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
                          a.k.a. {e.aliases.join(", ")}
                        </span>
                      )}
                    </header>
                    <p className="text-sm leading-relaxed text-[var(--fg)]">
                      {e.short}
                    </p>
                    {e.long && (
                      <p className="text-xs leading-relaxed text-[var(--fg-dim)]">
                        {e.long}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
