"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  Clock,
  ExternalLink,
  Link2,
  RefreshCw,
  Unlink,
  Upload,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import { GAME_TYPES, SKILL_RANGE, type GameType } from "@/lib/rack/rules/race";
import type {
  RosterClaimRow,
  RosterDetail,
  RosterPlayer,
} from "@/lib/rack/types";
import { AuthPanel } from "./AuthPanel";
import { useSession } from "./RackShell";
import {
  Avatar,
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  Note,
  Pill,
  PoolBallLoader,
  SectionTitle,
  Select,
} from "./ui";

/**
 * Your Rack Up profile, and the link to your Top Dawgs roster page.
 *
 * The link is not a dropdown you can just set. Anyone can create an account
 * here, and the old version let them attach it to any name on the roster —
 * including a team-mate's — which would put their record on someone else's
 * page. So it is a request an admin approves, and the database refuses to move
 * `apa_member_id` any other way.
 *
 * Once approved, the roster photo and skill level come across on their own.
 * That's the payoff for the extra step: nobody has to retype what the league
 * already knows about them.
 */
export function ProfileView() {
  const supabase = getSupabaseBrowser();
  const { user, profile, loading, refresh } = useSession();

  const [name, setName] = useState("");
  const [skills, setSkills] = useState<Partial<Record<GameType, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setSkills(
      Object.fromEntries(
        GAME_TYPES.map((g) => [g, profile.skill_levels?.[g]?.toString() ?? ""]),
      ),
    );
  }, [profile]);

  async function uploadAvatar(file: File) {
    if (!supabase || !user) return;
    if (!file.type.startsWith("image/")) {
      setError("That doesn't look like an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Images need to be under 5 MB.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      // Foldered by user id, which is what the storage policy keys on, and
      // timestamped because the bucket is CDN-cached — reusing a path would
      // keep serving the old picture.
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!supabase || !user) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const skillLevels: Partial<Record<GameType, number>> = {};
      for (const game of GAME_TYPES) {
        const raw = skills[game]?.trim();
        if (!raw) continue;
        const value = Number(raw);
        const { min, max } = SKILL_RANGE[game];
        if (!Number.isInteger(value) || value < min || value > max) {
          throw new Error(
            `${game} skill level must be a whole number from ${min} to ${max}.`,
          );
        }
        skillLevels[game] = value;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          skill_levels: skillLevels,
          skill_level: skillLevels["8-ball"] ?? skillLevels["9-ball"] ?? null,
        })
        .eq("id", user.id);
      if (updateError) throw updateError;

      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PoolBallLoader label="Loading your profile" />;
  if (!user) return <AuthPanel />;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <Avatar
            name={profile?.name ?? name ?? "?"}
            url={profile?.avatar_url}
            size={72}
            ring={Boolean(profile?.apa_member_id)}
          />
          <div className="min-w-0">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--rack-radius)] border border-[hsl(var(--rack-border-strong))] bg-[hsl(var(--rack-surface))] px-4 font-[family-name:var(--rack-font-heading)] text-sm font-semibold transition hover:border-[hsl(var(--rack-primary))]">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Change photo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = ""; // so picking the same file twice fires
                  if (file) void uploadAvatar(file);
                }}
              />
            </label>
            <p className="mt-1.5 text-xs text-[hsl(var(--rack-fg-muted))]">
              Optional — initials are used otherwise. Under 5 MB.
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-5">
        <SectionTitle>Details</SectionTitle>

        <Field label="Display name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div>
          <p className="mb-1 font-[family-name:var(--rack-font-heading)] text-xs font-bold uppercase tracking-wider text-[hsl(var(--rack-fg-muted))]">
            Skill levels
          </p>
          <p className="mb-3 text-xs text-[hsl(var(--rack-fg-muted))]">
            These decide your race. 8-ball runs {SKILL_RANGE["8-ball"].min}–
            {SKILL_RANGE["8-ball"].max}, 9-ball {SKILL_RANGE["9-ball"].min}–
            {SKILL_RANGE["9-ball"].max}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {GAME_TYPES.map((game) => (
              <Field key={game} label={game}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={SKILL_RANGE[game].min}
                  max={SKILL_RANGE[game].max}
                  value={skills[game] ?? ""}
                  onChange={(e) =>
                    setSkills((prev) => ({ ...prev, [game]: e.target.value }))
                  }
                  placeholder="—"
                />
              </Field>
            ))}
          </div>
        </div>

        <ErrorNote>{error}</ErrorNote>
        {saved && (
          <p className="flex items-center gap-2 text-sm text-[hsl(var(--rack-success))]">
            <Check className="h-4 w-4" /> Saved
          </p>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </Card>

      <RosterLink onImported={refresh} />

      <p className="text-center text-xs text-[hsl(var(--rack-fg-muted))]">
        Signed in as {user.email}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * The roster link: claim, pending, or linked.
 *
 * Nothing about this is offered by default — it only appears as an invitation
 * to claim, and claiming opens a request rather than setting anything.
 */
function RosterLink({ onImported }: { onImported: () => Promise<void> }) {
  const supabase = getSupabaseBrowser();
  const { user, profile } = useSession();

  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [claim, setClaim] = useState<RosterClaimRow | null>(null);
  const [linked, setLinked] = useState<RosterDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const importedOnce = useRef(false);

  const memberId = profile?.apa_member_id ?? null;

  /* Roster list, for the picker. */
  useEffect(() => {
    let active = true;
    void fetch("/api/rack/roster")
      .then((r) => (r.ok ? r.json() : { players: [] }))
      .then((json) => {
        if (active) setRoster(json.players ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  /* Any open or recent request of mine. */
  const loadClaim = useCallback(async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from("rack_roster_claims")
      .select("*")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setClaim((data as RosterClaimRow | null) ?? null);
  }, [supabase, user]);

  useEffect(() => {
    void loadClaim();
  }, [loadClaim]);

  /* The linked player's details. */
  useEffect(() => {
    if (!memberId) {
      setLinked(null);
      return;
    }
    let active = true;
    void fetch(`/api/rack/roster/${encodeURIComponent(memberId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (active) setLinked(json);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [memberId]);

  /**
   * The one-time import after a claim is approved. `apa_imported_at` is the
   * guard: approval nulls it, this sets it, so a later manual edit to your
   * photo or skill level is never quietly overwritten.
   */
  const runImport = useCallback(
    async (manual = false) => {
      if (!supabase || !user || !profile || !memberId) return;
      if (!manual && (profile.apa_imported_at || importedOnce.current)) return;
      importedOnce.current = true;

      setImporting(true);
      setError(null);
      try {
        const res = await fetch(`/api/rack/roster/${encodeURIComponent(memberId)}`);
        if (!res.ok) throw new Error("Couldn't read your roster profile.");
        const detail = (await res.json()) as RosterDetail;

        const patch: Record<string, unknown> = {
          apa_imported_at: new Date().toISOString(),
        };
        if (detail.name) patch.name = detail.name;
        if (detail.profileImage) patch.avatar_url = detail.profileImage;

        if (typeof detail.skillLevel === "number") {
          // APA rates 8-ball and 9-ball separately, so put the level on the
          // game it was actually earned in rather than both.
          const game: GameType = detail.format === "9-ball" ? "9-ball" : "8-ball";
          patch.skill_levels = {
            ...(profile.skill_levels ?? {}),
            [game]: detail.skillLevel,
          };
          patch.skill_level = detail.skillLevel;
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update(patch)
          .eq("id", user.id);
        if (updateError) throw updateError;
        await onImported();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      } finally {
        setImporting(false);
      }
    },
    [supabase, user, profile, memberId, onImported],
  );

  useEffect(() => {
    if (memberId && profile && !profile.apa_imported_at) void runImport();
  }, [memberId, profile, runImport]);

  async function request() {
    if (!supabase || !choice) return;
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("rack_request_roster_claim", {
        p_apa_member_id: choice,
        p_note: note.trim() || null,
      });
      if (rpcError) throw rpcError;
      setOpen(false);
      setNote("");
      await loadClaim();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that request.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("rack_unlink_roster");
      if (rpcError) throw rpcError;
      importedOnce.current = false;
      await onImported();
      await loadClaim();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't unlink.");
    } finally {
      setBusy(false);
    }
  }

  const claimedName = useMemo(
    () => roster.find((p) => p.id === claim?.apa_member_id)?.name ?? claim?.apa_member_id,
    [roster, claim],
  );

  /* ---- linked ---------------------------------------------------------- */
  if (memberId) {
    return (
      <Card>
        <SectionTitle
          action={
            <Pill tone="win">
              <BadgeCheck className="h-3 w-3" /> verified
            </Pill>
          }
        >
          Top Dawgs roster
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={linked?.name ?? "?"} url={linked?.profileImage} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{linked?.name ?? memberId}</p>
            <p className="text-xs text-[hsl(var(--rack-fg-muted))]">
              {linked?.skillLevel != null
                ? `SL ${linked.skillLevel} · ${linked.format}`
                : "Linked"}
            </p>
          </div>
          <Link href={`/roster/${memberId}`} target="_blank">
            <Button variant="secondary" size="sm">
              Roster page <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <p className="mt-3 text-xs text-[hsl(var(--rack-fg-muted))]">
          Matches you score here show on your roster page. They stay out of Patch
          Watch — that leaderboard counts league scoresheets only.
        </p>

        <ErrorNote>{error}</ErrorNote>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={importing}
            onClick={() => void runImport(true)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${importing ? "animate-spin" : ""}`} />
            {importing ? "Syncing…" : "Re-sync photo & skill"}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void unlink()}>
            <Unlink className="h-3.5 w-3.5" /> Unlink
          </Button>
        </div>
      </Card>
    );
  }

  /* ---- pending --------------------------------------------------------- */
  if (claim?.status === "pending") {
    return (
      <Card>
        <SectionTitle
          action={
            <Pill tone="accent">
              <Clock className="h-3 w-3" /> waiting
            </Pill>
          }
        >
          Top Dawgs roster
        </SectionTitle>
        <Note>
          Your request to link as <strong>{claimedName}</strong> is with the team
          admin. Once they approve it, your roster photo and skill level come
          across automatically.
        </Note>
        <ErrorNote>{error}</ErrorNote>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => {
            setOpen(true);
            setChoice(claim.apa_member_id);
          }}
        >
          Pick a different player
        </Button>
        {open && (
          <ClaimForm
            roster={roster}
            choice={choice}
            setChoice={setChoice}
            note={note}
            setNote={setNote}
            busy={busy}
            onSubmit={request}
            onCancel={() => setOpen(false)}
          />
        )}
      </Card>
    );
  }

  /* ---- not linked ------------------------------------------------------ */
  return (
    <Card>
      <SectionTitle>Top Dawgs roster</SectionTitle>

      {claim?.status === "rejected" && (
        <ErrorNote>
          Your last request wasn&apos;t approved. Check with the team captain before
          trying again.
        </ErrorNote>
      )}

      <p className="text-sm text-[hsl(var(--rack-fg-muted))]">
        Play for the Top Dawgs? Link your account to your roster page and your
        photo and skill level come across automatically — no retyping what the
        league already knows.
      </p>

      {!open ? (
        <Button variant="primary" className="mt-4" onClick={() => setOpen(true)}>
          <Link2 className="h-4 w-4" /> Claim your roster spot
        </Button>
      ) : (
        <ClaimForm
          roster={roster}
          choice={choice}
          setChoice={setChoice}
          note={note}
          setNote={setNote}
          busy={busy}
          onSubmit={request}
          onCancel={() => setOpen(false)}
        />
      )}

      <ErrorNote>{error}</ErrorNote>
    </Card>
  );
}

function ClaimForm({
  roster,
  choice,
  setChoice,
  note,
  setNote,
  busy,
  onSubmit,
  onCancel,
}: {
  roster: RosterPlayer[];
  choice: string;
  setChoice: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  busy: boolean;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 space-y-4 rounded-[var(--rack-radius)] border border-[hsl(var(--rack-border))] bg-[hsl(var(--rack-bg-soft))] p-4">
      <Field label="Which player are you?">
        <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Choose your name…</option>
          {roster.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Anything to add?"
        hint="Optional — helps whoever approves this know it's really you."
      >
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. it's Rob, I captain the team"
          maxLength={200}
        />
      </Field>

      <p className="text-xs text-[hsl(var(--rack-fg-muted))]">
        This sends a request. A team admin approves it before anything links —
        that&apos;s what stops someone claiming a team-mate&apos;s page.
      </p>

      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-[2]"
          disabled={busy || !choice}
          onClick={() => void onSubmit()}
        >
          {busy ? "Sending…" : "Send request"}
        </Button>
      </div>
    </div>
  );
}
