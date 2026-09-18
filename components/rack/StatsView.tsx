"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import { DRILLS } from "@/lib/rack/rules/drills";
import { GAME_TYPES, type GameType } from "@/lib/rack/rules/race";
import type {
  HeadToHeadRow,
  PlayerStatsRow,
  PracticeStatsRow,
  ProfileRow,
} from "@/lib/rack/types";
import { pct } from "@/lib/utils";
import { Avatar, Button, Card, EmptyState, Pill, PoolBallLoader } from "./ui";

/**
 * Lifetime stats across everyone who plays.
 *
 * The old app's stats screen was a single 2,373-line component that fetched
 * every table and computed everything inline. This reads the aggregates the
 * finaliser already maintains, so the numbers here are the same ones the
 * database committed when each match ended rather than a second, parallel
 * calculation that can disagree with them.
 */
export function StatsView() {
  const supabase = getSupabaseBrowser();
  const [game, setGame] = useState<GameType>("8-ball");
  const [stats, setStats] = useState<PlayerStatsRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [h2h, setH2h] = useState<HeadToHeadRow[]>([]);
  const [practice, setPractice] = useState<PracticeStatsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [statsRes, profileRes, h2hRes, practiceRes] = await Promise.all([
      supabase.from("player_stats").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("head_to_head").select("*").order("last_match_date", { ascending: false }).limit(20),
      supabase.from("practice_stats").select("*"),
    ]);
    setStats((statsRes.data ?? []) as PlayerStatsRow[]);
    setProfiles((profileRes.data ?? []) as ProfileRow[]);
    setH2h((h2hRes.data ?? []) as HeadToHeadRow[]);
    setPractice((practiceRes.data ?? []) as PracticeStatsRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = useCallback(
    (id: string) => profiles.find((p) => p.id === id)?.name ?? "Unknown",
    [profiles],
  );
  const profileOf = useCallback(
    (id: string) => profiles.find((p) => p.id === id) ?? null,
    [profiles],
  );

  const table = useMemo(
    () =>
      stats
        .filter((s) => s.game_type === game && (s.matches_played ?? 0) > 0)
        .sort(
          (a, b) =>
            (b.wins ?? 0) - (a.wins ?? 0) ||
            (b.matches_played ?? 0) - (a.matches_played ?? 0),
        ),
    [stats, game],
  );

  if (loading) return <PoolBallLoader label="Loading stats" />;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {GAME_TYPES.map((g) => (
          <Button
            key={g}
            variant={game === g ? "primary" : "secondary"}
            onClick={() => setGame(g)}
          >
            {g}
          </Button>
        ))}
      </div>

      {table.length === 0 ? (
        <EmptyState title={`No ${game} matches yet`}>
          Score one at a table and it&apos;ll show up here. Casual matches are
          deliberately left out.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--rack-border))] text-left text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--rack-accent))]">
                <th className="px-4 py-3">Player</th>
                <th className="px-3 py-3 text-right">W</th>
                <th className="px-3 py-3 text-right">L</th>
                <th className="px-3 py-3 text-right">Win %</th>
                <th className="px-3 py-3 text-right">B&amp;R</th>
                <th className="px-3 py-3 text-right">On break</th>
                <th className="px-3 py-3 text-right">Streak</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => {
                const profile = profileOf(row.user_id);
                const wins = row.wins ?? 0;
                const losses = row.losses ?? 0;
                const streak = row.current_streak ?? 0;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[hsl(var(--rack-border))] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <Avatar
                          name={profile?.name ?? "?"}
                          url={profile?.avatar_url}
                          size={28}
                        />
                        <span className="truncate">{profile?.name ?? "Unknown"}</span>
                        {profile?.apa_member_id && (
                          <Link
                            href={`/roster/${profile.apa_member_id}`}
                            className="text-[hsl(var(--rack-accent))] underline underline-offset-4"
                          >
                            roster
                          </Link>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">{wins}</td>
                    <td className="px-3 py-3 text-right text-[hsl(var(--rack-fg-muted))]">{losses}</td>
                    <td className="px-3 py-3 text-right">
                      {wins + losses > 0 ? `${pct(wins, wins + losses)}%` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">{row.break_and_runs ?? 0}</td>
                    <td className="px-3 py-3 text-right">{row.eight_on_breaks ?? 0}</td>
                    <td className="px-3 py-3 text-right">
                      {streak === 0 ? (
                        "—"
                      ) : (
                        <Pill tone={streak > 0 ? "win" : "hot"}>
                          {streak > 0 ? `W${streak}` : `L${Math.abs(streak)}`}
                        </Pill>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {h2h.length > 0 && (
        <section>
          <h2 className="mb-3 font-[family-name:var(--rack-font-display)] text-2xl tracking-wide">
            Head to head
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {h2h.map((row) => (
              <Card key={row.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm">{nameOf(row.player1_id)}</span>
                <span className="shrink-0 font-[family-name:var(--rack-font-display)] text-xl tracking-wide text-[hsl(var(--rack-accent))]">
                  {row.player1_wins ?? 0} — {row.player2_wins ?? 0}
                </span>
                <span className="truncate text-right text-sm">
                  {nameOf(row.player2_id)}
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-[family-name:var(--rack-font-display)] text-2xl tracking-wide">
          Practice
        </h2>
        {practice.length === 0 ? (
          <EmptyState title="No practice logged yet">
            Run a drill from a table to start building a record.
          </EmptyState>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {DRILLS.map((drill) => {
              const rows = practice
                .filter((p) => p.drill_type === drill.id)
                .sort((a, b) => (b.best_score ?? 0) - (a.best_score ?? 0))
                .slice(0, 3);
              if (rows.length === 0) return null;
              return (
                <Card key={drill.id}>
                  <p className="font-semibold">{drill.name}</p>
                  <p className="mb-2 text-xs text-[hsl(var(--rack-fg-muted))]">
                    Target {drill.target}
                  </p>
                  <ul className="space-y-1 text-sm">
                    {rows.map((row) => (
                      <li key={row.id} className="flex justify-between gap-2">
                        <span className="truncate">{nameOf(row.user_id)}</span>
                        <span className="text-[hsl(var(--rack-accent))]">
                          best {row.best_score ?? 0}
                          <span className="ml-2 text-xs text-[hsl(var(--rack-fg-muted))]">
                            {row.completions ?? 0}/{row.total_attempts ?? 0} clean
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
