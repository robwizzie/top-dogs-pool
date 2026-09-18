"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Link2, Upload } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import { GAME_TYPES, SKILL_RANGE, type GameType } from "@/lib/rack/rules/race";
import { AuthPanel } from "./AuthPanel";
import { useSession } from "./RackShell";
import { Avatar, Button, Card, ErrorNote, Field, Input, Pill, Spinner } from "./ui";

type RosterOption = { id: string; name: string };

/**
 * Profile editing, plus the link between a Rack Up account and an APA roster
 * player.
 *
 * That link is what makes the two halves of the site one thing: once set, a
 * player's Rack Up record shows on their roster page. It is display-only by
 * design — Rack Up results never feed the Patch Watch leaderboard, which stays
 * sourced purely from APA scoresheets.
 */
export function ProfileView() {
  const supabase = getSupabaseBrowser();
  const { user, profile, loading, refresh } = useSession();

  const [name, setName] = useState("");
  const [skills, setSkills] = useState<Partial<Record<GameType, string>>>({});
  const [apaId, setApaId] = useState("");
  const [roster, setRoster] = useState<RosterOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setApaId(profile.apa_member_id ?? "");
    setSkills(
      Object.fromEntries(
        GAME_TYPES.map((g) => [g, profile.skill_levels?.[g]?.toString() ?? ""]),
      ),
    );
  }, [profile]);

  // The roster comes from the site's own APA snapshot, so the dropdown offers
  // real team-mates rather than asking someone to type a member number.
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

  const linked = useMemo(
    () => roster.find((p) => p.id === (profile?.apa_member_id ?? "")),
    [roster, profile],
  );

  if (loading) return <Spinner />;
  if (!user) return <AuthPanel />;

  /**
   * Avatars go to the `avatars` bucket under a folder named after the user's
   * id, which is what the storage policy keys on — so nobody can overwrite
   * anyone else's picture. The file name carries a timestamp because the
   * bucket is public and CDN-cached; reusing a path would serve the old image.
   */
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
          throw new Error(`${game} skill level must be a whole number from ${min} to ${max}.`);
        }
        skillLevels[game] = value;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          skill_levels: skillLevels,
          // Keep the legacy single column roughly in step for anything still
          // reading it.
          skill_level: skillLevels["8-ball"] ?? skillLevels["9-ball"] ?? null,
          apa_member_id: apaId.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        // The unique index means a member number can only be claimed once.
        if (updateError.code === "23505") {
          throw new Error(
            "That APA member number is already linked to another account.",
          );
        }
        throw updateError;
      }

      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={profile?.name ?? name ?? "?"} url={profile?.avatar_url} size={64} />
        <div>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] px-4 text-sm font-semibold transition hover:border-[var(--color-brass)]">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Change photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Reset the input so picking the same file twice still fires.
                e.target.value = "";
                if (file) void uploadAvatar(file);
              }}
            />
          </label>
          <p className="mt-1 text-xs text-[var(--fg-dim)]">
            Optional — initials are used otherwise. Under 5 MB.
          </p>
        </div>
      </div>

      <Field label="Display name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brass)]">
          Skill levels
        </p>
        <p className="mb-3 text-xs text-[var(--fg-dim)]">
          These set your race. 8-ball runs {SKILL_RANGE["8-ball"].min}–
          {SKILL_RANGE["8-ball"].max}; 9-ball runs {SKILL_RANGE["9-ball"].min}–
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

      <div className="border-t border-[var(--border)] pt-5">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brass)]">
          <Link2 className="h-3.5 w-3.5" /> Link to the roster
        </p>
        <p className="mb-3 text-xs text-[var(--fg-dim)]">
          Connect this account to your APA player page so matches scored here show
          up there. Your Rack Up results stay out of the Patch Watch leaderboard —
          that one only counts APA scoresheets.
        </p>

        {roster.length > 0 ? (
          <Field label="Roster player">
            <select
              value={apaId}
              onChange={(e) => setApaId(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-black/30 px-3 text-[var(--fg)] focus:border-[var(--color-brass)] focus:outline-none"
            >
              <option value="">Not linked</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="APA member number" hint="The roster list isn't available right now — enter the number directly.">
            <Input
              value={apaId}
              onChange={(e) => setApaId(e.target.value)}
              placeholder="e.g. 12345678"
              inputMode="numeric"
            />
          </Field>
        )}

        {linked && (
          <Link
            href={`/roster/${linked.id}`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-brass)] underline underline-offset-4"
          >
            View {linked.name}&apos;s roster page <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <ErrorNote>{error}</ErrorNote>
      {saved && (
        <p className="flex items-center gap-2 text-sm text-[var(--color-felt-bright)]">
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

      <p className="text-center text-xs text-[var(--fg-dim)]">
        Signed in as {user.email}
        {profile?.apa_member_id && (
          <>
            {" · "}
            <Pill tone="brass">roster linked</Pill>
          </>
        )}
      </p>
    </Card>
  );
}
