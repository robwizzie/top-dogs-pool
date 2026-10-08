"use client";

import { useState, type ReactNode } from "react";
import { Check, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import { GUEST_SCHEMA_MISSING, useGuests, type GuestDraft } from "@/lib/rack/hooks/useGuests";
import { GAME_TYPES, SKILL_RANGE, type GameType } from "@/lib/rack/rules/race";
import type { ProfileRow } from "@/lib/rack/types";
import { Avatar, Button, ConfirmAction, ErrorNote, Field, Input, Note, Select } from "./ui";

/**
 * Getting a second player to the table without a second account.
 *
 * Rack Up previously needed everyone in a match to sign up, which is the wrong
 * price for a Tuesday night: one person has the app open and the others are
 * holding cues. A guest is somebody you enter by name and skill level, so the
 * whole match can be set up and scored from one phone.
 *
 * Guests are kept on the account that entered them rather than on the table,
 * so the second week Dave is one tap rather than a form. That is also why the
 * saved list comes first here and the form is the thing you open — the common
 * case should be the short one.
 */
export function AddPlayerPanel({
  ownerId,
  roomId,
  /** Ids already seated, so the list can show who's here rather than offering them twice. */
  seatedIds,
  onSeated,
  onClose,
}: {
  ownerId: string;
  roomId: string;
  seatedIds: string[];
  /** Called after anyone is seated or edited; `guest` is set when someone was just seated. */
  onSeated: (guest?: ProfileRow) => void | Promise<void>;
  onClose: () => void;
}) {
  const supabase = getSupabaseBrowser();
  const book = useGuests(ownerId);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function seat(guest: ProfileRow) {
    if (!supabase) return;
    setBusyId(guest.id);
    setError(null);
    const { error: err } = await supabase
      .from("room_players")
      .insert({ room_id: roomId, user_id: guest.id });
    setBusyId(null);
    // Already at the table — another tab, or a double tap — counts as seated.
    if (err && err.code !== "23505") {
      setError(
        err.code === "42501"
          ? `Couldn't seat ${guest.name} — only the account that added a guest can bring them to a table.`
          : err.message,
      );
      return;
    }
    await onSeated(guest);
  }

  async function createAndSeat(draft: GuestDraft) {
    const guest = await book.create(draft);
    if (!guest) return;
    setAdding(false);
    await seat(guest);
  }

  const unseated = book.guests.filter((g) => !seatedIds.includes(g.id));
  const seated = book.guests.filter((g) => seatedIds.includes(g.id));

  return (
    <div className="rack-fade-in space-y-3 rounded-[var(--rack-radius)] border border-[hsl(var(--rack-border))] bg-[hsl(var(--rack-bg-soft))] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-[family-name:var(--rack-font-heading)] text-sm font-bold">
          {editing ? `Edit ${editing.name}` : "Add someone without an account"}
        </p>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {book.unavailable ? (
        <Note>{GUEST_SCHEMA_MISSING}</Note>
      ) : (
        <ErrorNote>{error ?? book.error}</ErrorNote>
      )}

      {book.unavailable ? null : book.loading ? (
        <p className="py-2 text-sm text-[hsl(var(--rack-fg-muted))]">Loading your guests…</p>
      ) : editing ? (
        <GuestForm
          initial={editing}
          submitLabel="Save"
          onCancel={() => setEditing(null)}
          onSubmit={async (draft) => {
            if (await book.update(editing.id, draft)) {
              setEditing(null);
              await onSeated();
            }
          }}
          footer={
            <ConfirmAction
              variant="ghost"
              label="Delete this guest"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              question={
                <>
                  Delete <strong>{editing.name}</strong>? Their record and
                  head-to-head go with them. Matches they played stay, with their
                  name on them.
                </>
              }
              confirmLabel="Delete guest"
              onConfirm={async () => {
                if (await book.remove(editing.id)) {
                  setEditing(null);
                  await onSeated();
                }
              }}
            />
          }
        />
      ) : adding ? (
        <GuestForm
          submitLabel="Add to the table"
          onCancel={() => setAdding(false)}
          onSubmit={createAndSeat}
        />
      ) : (
        <>
          {unseated.length > 0 && (
            <ul className="space-y-2">
              {unseated.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center gap-2 rounded-[var(--rack-radius)] border border-[hsl(var(--rack-border))] bg-[hsl(var(--rack-surface))] px-3 py-2"
                >
                  <Avatar name={g.name} url={g.avatar_url} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{g.name}</span>
                    <span className="block truncate text-xs text-[hsl(var(--rack-fg-muted))]">
                      {describeSkills(g)}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setEditing(g)}
                    aria-label={`Edit ${g.name}`}
                    title={`Edit ${g.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    disabled={busyId === g.id}
                    onClick={() => void seat(g)}
                  >
                    {busyId === g.id ? "…" : "Seat"}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {seated.length > 0 && (
            <p className="text-xs text-[hsl(var(--rack-fg-muted))]">
              Already at the table: {seated.map((g) => g.name).join(", ")}.
            </p>
          )}

          <Button variant="accent" className="w-full" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" />
            {book.guests.length > 0 ? "New guest" : "Add a guest"}
          </Button>
          <p className="text-xs text-[hsl(var(--rack-fg-muted))]">
            You score for both of you. Guests are saved to your account, so
            they&apos;re one tap next time.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Form */

function GuestForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  footer,
}: {
  initial?: ProfileRow;
  submitLabel: string;
  onSubmit: (draft: GuestDraft) => void | Promise<void>;
  onCancel: () => void;
  /** Anything that belongs with this guest rather than with the list — delete. */
  footer?: ReactNode;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [skills, setSkills] = useState<Partial<Record<GameType, number>>>(
    () => ({ ...(initial?.skill_levels ?? {}) }),
  );
  const [busy, setBusy] = useState(false);

  // A match refuses to start without a skill level for the game being played,
  // and there is no honest default for a stranger's handicap — so ask for at
  // least one here rather than letting the setup screen dead-end later.
  const ready = name.trim().length > 0 && Object.keys(skills).length > 0;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await onSubmit({ name, skills });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dave"
            autoFocus
            maxLength={40}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          {GAME_TYPES.map((g) => (
            <Field key={g} label={`${g} skill level`}>
              <Select
                value={skills[g] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSkills((prev) => {
                    const next = { ...prev };
                    if (v === "") delete next[g];
                    else next[g] = Number(v);
                    return next;
                  });
                }}
              >
                <option value="">Not set</option>
                {skillOptions(g).map((n) => (
                  <option key={n} value={n}>
                    SL {n}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>

        <p className="text-xs text-[hsl(var(--rack-fg-muted))]">
          {Object.keys(skills).length === 0 && name.trim().length > 0 && (
            <strong className="text-[hsl(var(--rack-fg))]">Pick at least one. </strong>
          )}
          Set the level for whichever game you&apos;re playing — the race comes
          straight off the APA chart, so a guess here changes the match.
        </p>

        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-[2]"
            disabled={!ready || busy}
          >
            <Check className="h-4 w-4" />
            {busy ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>

      {footer && (
        <div className="border-t border-[hsl(var(--rack-border))] pt-3">{footer}</div>
      )}
    </div>
  );
}

function skillOptions(game: GameType): number[] {
  const { min, max } = SKILL_RANGE[game];
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

function describeSkills(p: ProfileRow): string {
  const parts = GAME_TYPES.map((g) => {
    const s = p.skill_levels?.[g];
    return typeof s === "number" ? `${g} SL${s}` : null;
  }).filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No skill level set";
}
