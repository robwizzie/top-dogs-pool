"use client";

import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { showToast } from "@/components/ui/Toaster";

/**
 * All the localStorage keys this app owns. Update this list when adding
 * new persisted state so it's included in backups.
 */
const STORAGE_KEYS = [
  "topdogs:drilled-shots",
  "topdogs:shot-stats",
  "topdogs:shot-notes",
  "topdogs:dawg-drill-session",
  "topdogs:sessions",
  "topdogs:active-session",
  "topdogs:bowliards-games",
  "topdogs:drill-scores",
] as const;

type Backup = {
  app: "top-dogs-pool";
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
};

/**
 * Export / import the player's tracker data as a JSON file. Lets a player
 * move stats across devices or back up before clearing browser storage.
 */
export function DataIO() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function exportData() {
    if (typeof window === "undefined") return;
    const data: Record<string, unknown> = {};
    for (const key of STORAGE_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (raw === null) continue;
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
    const backup: Backup = {
      app: "top-dogs-pool",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = href;
    a.download = `top-dogs-pool-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    showToast({
      message: "Backup downloaded",
      detail: `${Object.keys(data).length} stores included`,
      kind: "success",
    });
  }

  function triggerImport() {
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text) as Backup;
        if (parsed.app !== "top-dogs-pool" || !parsed.data) {
          throw new Error("Not a Top Dogs Pool backup");
        }
        const merge = window.confirm(
          "Import will overwrite your current tracker data. Continue?",
        );
        if (!merge) return;
        for (const key of STORAGE_KEYS) {
          if (key in parsed.data) {
            window.localStorage.setItem(
              key,
              JSON.stringify(parsed.data[key]),
            );
          }
        }
        // Broadcast a synthetic storage event so the open hooks pick it up
        // without a hard reload (Storage events don't normally fire for
        // same-page writes).
        for (const key of STORAGE_KEYS) {
          window.dispatchEvent(new Event(`${key}-change`));
        }
        showToast({
          message: "Backup restored",
          detail: "Reload the page to see all stats refresh",
          kind: "success",
        });
      } catch (err) {
        showToast({
          message: "Import failed",
          detail: err instanceof Error ? err.message : "Invalid file",
          kind: "error",
        });
      } finally {
        // Reset the input so the same file can be selected again.
        if (inputRef.current) inputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      showToast({
        message: "Could not read file",
        kind: "error",
      });
    };
    reader.readAsText(file);
  }

  return (
    <div className="surface p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
        Backup / restore
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--fg-dim)]">
        Tracker data, notes, and drilled flags live in this browser only.
        Download a JSON backup to keep them safe or move them to another
        device.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportData}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg)] transition-colors hover:border-[var(--color-brass)]/60 hover:text-[var(--color-brass-bright)]"
        >
          <Download size={13} />
          Download backup
        </button>
        <button
          type="button"
          onClick={triggerImport}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg)] transition-colors hover:border-[var(--color-brass)]/60 hover:text-[var(--color-brass-bright)]"
        >
          <Upload size={13} />
          Restore from backup
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          className="hidden"
        />
      </div>
    </div>
  );
}
