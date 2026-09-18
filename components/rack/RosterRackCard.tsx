"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import { RACK_CONFIGURED } from "@/lib/rack/supabase/env";
import type { PlayerStatsRow, ProfileRow } from "@/lib/rack/types";
import { pct } from "@/lib/utils";

/**
 * The Rack Up record for an APA roster player, shown on their /roster page.
 *
 * This is the whole point of the `apa_member_id` link: a player scored at the
 * table on Tuesday shows up on the same page as their league record.
 *
 * It is strictly display-only. Nothing here feeds Patch Watch — that
 * leaderboard stays sourced from APA scoresheets and hand-entered tournament
 * results, so a casual Tuesday session can't move the standings.
 *
 * Renders nothing at all when the player has no linked account or no matches,
 * so roster pages for people who don't use Rack Up are unchanged.
 */
export function RosterRackCard({ apaMemberId }: { apaMemberId: string }) {
  const supabase = getSupabaseBrowser();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [stats, setStats] = useState<PlayerStatsRow[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void (async () => {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("*")
        .eq("apa_member_id", apaMemberId)
        .maybeSingle();
      if (!active || !profileRow) return;
      setProfile(profileRow as ProfileRow);

      const { data: statRows } = await supabase
        .from("player_stats")
        .select("*")
        .eq("user_id", (profileRow as ProfileRow).id);
      if (active) setStats((statRows ?? []) as PlayerStatsRow[]);
    })();

    return () => {
      active = false;
    };
  }, [supabase, apaMemberId]);

  if (!RACK_CONFIGURED || !profile) return null;

  const played = stats.reduce((sum, s) => sum + (s.matches_played ?? 0), 0);
  if (played === 0) return null;

  const wins = stats.reduce((sum, s) => sum + (s.wins ?? 0), 0);
  const losses = stats.reduce((sum, s) => sum + (s.losses ?? 0), 0);
  const bnr = stats.reduce((sum, s) => sum + (s.break_and_runs ?? 0), 0);
  const onBreak = stats.reduce((sum, s) => sum + (s.eight_on_breaks ?? 0), 0);

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
          At the table
        </h2>
        <Link
          href="/rack"
          className="text-xs text-[var(--color-brass)] underline underline-offset-4"
        >
          Rack Up
        </Link>
      </div>
      <p className="mt-1 text-xs text-[var(--fg-dim)]">
        Scored live in Rack Up. Separate from the league record above — these
        don&apos;t count toward Patch Watch.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Record" value={`${wins}–${losses}`} />
        <Stat
          label="Win rate"
          value={wins + losses > 0 ? `${pct(wins, wins + losses)}%` : "—"}
        />
        <Stat label="Break & run" value={bnr} />
        <Stat label="On the break" value={onBreak} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--fg-dim)]">
        {stats
          .filter((s) => (s.matches_played ?? 0) > 0)
          .map((s) => (
            <span
              key={s.id}
              className="rounded-full bg-white/5 px-2.5 py-1"
            >
              {s.game_type}: {s.wins ?? 0}–{s.losses ?? 0}
            </span>
          ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brass)]">
        {label}
      </dt>
      <dd className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
        {value}
      </dd>
    </div>
  );
}
