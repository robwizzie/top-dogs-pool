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
    <div className="pm-glass p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Notebook size={14} className="text-[var(--color-brass-bright)]" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          Your notes
        </p>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Your own cues — what pace, what english, what you cheat. Saves automatically."
        rows={4}
        className="mt-4 w-full resize-y rounded-2xl border-0 bg-black/40 bg-[repeating-linear-gradient(180deg,transparent_0,transparent_27px,rgba(224,190,107,0.07)_27px,rgba(224,190,107,0.07)_28px)] bg-local px-4 py-[0.4rem] text-sm leading-7 text-[var(--color-cream)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.05)] placeholder:text-[var(--color-cream)]/35 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(224,190,107,0.45)] focus:outline-none"
      />
    </div>
  );
}
