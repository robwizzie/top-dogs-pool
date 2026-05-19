"use client";

import { useEffect, useState } from "react";
import { Notebook } from "lucide-react";
import { useShotNotes } from "@/lib/kinister/useShotNotes";

const SAVE_DEBOUNCE_MS = 600;

export function ShotNotes({ shotId }: { shotId: string }) {
  const { note, save } = useShotNotes(shotId);
  const [draft, setDraft] = useState(note);
  const [savedFlag, setSavedFlag] = useState(false);

  // Sync from storage when the shot changes or another tab edits the note.
  useEffect(() => {
    setDraft(note);
  }, [note]);

  // Debounced autosave.
  useEffect(() => {
    if (draft === note) return;
    const t = setTimeout(() => {
      save(draft);
      setSavedFlag(true);
      const clear = setTimeout(() => setSavedFlag(false), 1500);
      return () => clearTimeout(clear);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft, note, save]);

  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Notebook size={16} className="text-[var(--color-brass-bright)]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Your notes
          </p>
        </div>
        <span
          aria-live="polite"
          className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-felt-bright)] opacity-0 transition-opacity"
          style={{ opacity: savedFlag ? 1 : 0 }}
        >
          Saved
        </span>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Your own cues — what pace, what english, what you cheat. Saves automatically."
        rows={4}
        className="mt-3 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm leading-relaxed text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus:border-[var(--border-strong)] focus:outline-none"
      />
    </div>
  );
}
