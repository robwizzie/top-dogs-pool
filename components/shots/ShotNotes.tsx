"use client";

import { useEffect, useState } from "react";
import { Notebook } from "lucide-react";
import { useShotNotes } from "@/lib/kinister/useShotNotes";
import { showToast } from "@/components/ui/Toaster";

const SAVE_DEBOUNCE_MS = 600;

export function ShotNotes({ shotId }: { shotId: string }) {
  const { note, save } = useShotNotes(shotId);
  const [draft, setDraft] = useState(note);

  // Sync from storage when the shot changes or another tab edits the note.
  useEffect(() => {
    setDraft(note);
  }, [note]);

  // Debounced autosave.
  useEffect(() => {
    if (draft === note) return;
    const t = setTimeout(() => {
      save(draft);
      showToast({ message: "Notes saved", kind: "success" });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft, note, save]);

  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2">
        <Notebook size={16} className="text-[var(--color-brass-bright)]" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          Your notes
        </p>
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
