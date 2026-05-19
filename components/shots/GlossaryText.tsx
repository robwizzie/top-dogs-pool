"use client";

import { useMemo } from "react";
import { GLOSSARY, type GlossaryEntry } from "@/lib/kinister/glossary";

/**
 * Render a string of plain text with any recognized glossary term inline-
 * linked. Hover / focus / tap the term to reveal a small popover with the
 * short definition. Matches are word-boundary, case-insensitive, and
 * preserve the original casing in display.
 */
export function GlossaryText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const segments = useMemo(() => splitByGlossary(text), [text]);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        typeof seg === "string" ? (
          <span key={i}>{seg}</span>
        ) : (
          <GlossaryTerm key={i} entry={seg.entry}>
            {seg.text}
          </GlossaryTerm>
        ),
      )}
    </span>
  );
}

type Segment = string | { entry: GlossaryEntry; text: string };

/**
 * Compile a regex matching every glossary term + alias (longest first so
 * 'inside english' wins over 'english'). Cached at module scope.
 */
const TERM_INDEX: { regex: RegExp; lookup: Map<string, GlossaryEntry> } =
  buildIndex();

function buildIndex(): {
  regex: RegExp;
  lookup: Map<string, GlossaryEntry>;
} {
  const lookup = new Map<string, GlossaryEntry>();
  const tokens: string[] = [];
  for (const entry of GLOSSARY) {
    const all = [entry.term, ...(entry.aliases ?? [])];
    for (const token of all) {
      const key = token.toLowerCase();
      // First registration wins so the canonical term outranks an alias.
      if (!lookup.has(key)) lookup.set(key, entry);
      tokens.push(token);
    }
  }
  // Longest first.
  tokens.sort((a, b) => b.length - a.length);
  const pattern = tokens
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return {
    regex: new RegExp(`\\b(${pattern})\\b`, "gi"),
    lookup,
  };
}

function splitByGlossary(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  // Reset lastIndex since the regex is shared.
  TERM_INDEX.regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_INDEX.regex.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const entry = TERM_INDEX.lookup.get(m[0].toLowerCase());
    if (entry) {
      out.push({ entry, text: m[0] });
    } else {
      out.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function GlossaryTerm({
  entry,
  children,
}: {
  entry: GlossaryEntry;
  children: React.ReactNode;
}) {
  return (
    <span className="group/glossary relative inline-block">
      <a
        href="/glossary"
        className="cursor-help underline decoration-dotted decoration-[var(--color-brass)]/60 underline-offset-2 transition-colors hover:text-[var(--color-brass-bright)]"
        // Capture clicks: if the popover is closed they get the glossary
        // page; if it's already open via hover/focus the link still works.
        title={entry.short}
      >
        {children}
      </a>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] p-3 text-left text-[12px] leading-snug text-[var(--fg)] opacity-0 shadow-xl transition-opacity group-hover/glossary:visible group-hover/glossary:opacity-100 group-focus-within/glossary:visible group-focus-within/glossary:opacity-100"
      >
        <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass-bright)]">
          {entry.term}
        </span>
        <span className="mt-1 block">{entry.short}</span>
      </span>
    </span>
  );
}
