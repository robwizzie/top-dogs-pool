import { PageHeader } from "@/components/ui/Section";
import { HeaderBackLink, HeaderChip } from "@/components/shots/TrainingUI";
import { GLOSSARY, type GlossaryEntry } from "@/lib/kinister/glossary";

export const dynamic = "force-static";

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

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function slug(term: string) {
  return "term-" + term.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function GlossaryPage() {
  const sections = SECTION_ORDER.map((section) => ({
    section,
    entries: GLOSSARY.filter((e) => e.category === section).sort((a, b) =>
      a.term.localeCompare(b.term),
    ),
  })).filter((s) => s.entries.length > 0);

  // Letter rail: each letter jumps to the alphabetically-first term that
  // starts with it, wherever that term sits in the category sections.
  const firstByLetter = new Map<string, string>();
  for (const e of [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term))) {
    const letter = e.term[0].toUpperCase();
    if (!firstByLetter.has(letter)) firstByLetter.set(letter, slug(e.term));
  }

  return (
    <>
      <PageHeader
        eyebrow="Training · Reference"
        title="Glossary"
        subtitle="The pool terms used in the technique notes, descriptions, and tips throughout the catalog. Open before diving into a new shot if a word in the brief doesn't click yet."
      >
        <div className="flex flex-wrap items-center gap-2">
          <HeaderBackLink href="/shots">All shots</HeaderBackLink>
          <HeaderChip>
            <span className="font-[family-name:var(--font-display)] text-base leading-none tracking-wide text-[var(--color-brass-bright)]">
              {GLOSSARY.length}
            </span>
            terms
          </HeaderChip>
          <HeaderChip>
            <span className="font-[family-name:var(--font-display)] text-base leading-none tracking-wide text-[var(--color-brass-bright)]">
              {sections.length}
            </span>
            chapters
          </HeaderChip>
        </div>
      </PageHeader>

      {/* Letter rail — a sticky strip on phones, a sidebar on desktop. */}
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-2 sm:px-6 sm:pb-16 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12 lg:px-8">
        <nav
          aria-label="Glossary index"
          className="sticky top-[calc(4.5rem+env(safe-area-inset-top))] z-10 -mx-4 mb-8 border-y border-[var(--color-cream)]/[0.07] bg-[var(--bg)]/85 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-28 lg:mx-0 lg:mb-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          <p className="mb-3 hidden text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)] lg:block">
            Chapters
          </p>
          <ol className="mb-8 hidden space-y-1 lg:block">
            {sections.map(({ section, entries }, i) => (
              <li key={section}>
                <a
                  href={`#${section.toLowerCase()}`}
                  className="group flex items-baseline gap-3 rounded-lg py-1 text-sm text-[var(--color-cream)]/65 transition-colors hover:text-[var(--color-brass-bright)]"
                >
                  <span className="font-[family-name:var(--font-display)] text-lg leading-none text-[var(--color-cream)]/30 group-hover:text-[var(--color-brass)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">{section}</span>
                  <span className="text-[11px] tabular-nums text-[var(--color-cream)]/30">
                    {entries.length}
                  </span>
                </a>
              </li>
            ))}
          </ol>
          <p className="mb-3 hidden text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)] lg:block">
            A — Z
          </p>
          <ul className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] lg:grid lg:grid-cols-6 lg:gap-1 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
            {ALPHABET.map((l) => {
              const target = firstByLetter.get(l);
              return (
                <li key={l} className="shrink-0">
                  {target ? (
                    <a
                      href={`#${target}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-lg leading-none text-[var(--color-cream)]/85 transition-colors hover:bg-[var(--color-brass)]/15 hover:text-[var(--color-brass-bright)]"
                    >
                      {l}
                    </a>
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-8 w-8 items-center justify-center font-[family-name:var(--font-display)] text-lg leading-none text-[var(--color-cream)]/15"
                    >
                      {l}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-16 sm:space-y-20">
          {sections.map(({ section, entries }, i) => (
            <section
              key={section}
              id={section.toLowerCase()}
              className="scroll-mt-32"
            >
              <header className="mb-2 flex items-end gap-4 sm:gap-6">
                <span
                  aria-hidden
                  className="pm-outline -mb-1 font-[family-name:var(--font-display)] text-6xl leading-none opacity-40 [-webkit-text-stroke-width:1px] sm:text-7xl"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.34em] text-[var(--color-brass)]">
                    Chapter {i + 1} · {entries.length} terms
                  </p>
                  <h2 className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide text-[var(--color-cream)] sm:text-5xl">
                    {section}
                  </h2>
                </div>
                <div className="pm-rule mb-2 hidden flex-1 sm:block" aria-hidden />
              </header>
              <p className="pm-serif mb-6 mt-4 max-w-2xl text-xl leading-snug text-[var(--color-cream)]/65 sm:text-2xl">
                {SECTION_DESCRIPTIONS[section]}
              </p>

              <dl className="pm-glass divide-y divide-[var(--color-cream)]/[0.07] overflow-hidden px-5 sm:px-8">
                {entries.map((e) => (
                  <div
                    key={e.term}
                    id={slug(e.term)}
                    className="grid scroll-mt-36 gap-2 py-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8"
                  >
                    <dt>
                      <h3 className="font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-wide text-[var(--color-cream)]">
                        {e.term}
                      </h3>
                      {e.aliases && e.aliases.length > 0 && (
                        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brass)]/80">
                          a.k.a. {e.aliases.join(" · ")}
                        </p>
                      )}
                    </dt>
                    <dd className="space-y-2">
                      <p className="text-base leading-relaxed text-[var(--color-cream)] sm:text-lg sm:leading-relaxed">
                        {e.short}
                      </p>
                      {e.long && (
                        <p className="text-sm leading-relaxed text-[var(--color-cream)]/55">
                          {e.long}
                        </p>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
