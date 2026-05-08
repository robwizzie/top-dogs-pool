import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { RackSkeleton } from "@/components/ui/RackSkeleton";
import { RADAR_COLORS, StatRadar } from "@/components/compare/StatRadar";
import { getRoster } from "@/lib/apa";
import { loadSnapshot } from "@/lib/apa/client";
import type { PlayerProfile } from "@/lib/apa/schemas";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compare",
  description:
    "Side-by-side stat comparison for any two to four Top Dogs players.",
};

const MAX_PICKS = 4;
const AXES = [
  "Win %",
  "Points",
  "Sweeps",
  "Mini",
  "B&R",
  "8-on-Break",
] as const;

type Props = {
  searchParams: Promise<{ players?: string }>;
};

function parsePicks(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw.split(",")) {
    const t = id.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_PICKS) break;
  }
  return out;
}

function buildPicksHref(ids: string[]): string {
  if (ids.length === 0) return "/compare";
  return `/compare?players=${ids.join(",")}`;
}

export default async function ComparePage({ searchParams }: Props) {
  const sp = await searchParams;
  const picked = parsePicks(sp.players);

  const [rosterRaw, snap] = await Promise.all([getRoster(), loadSnapshot()]);
  const roster = rosterRaw.filter((p) => p.visible !== false);

  const profiles: PlayerProfile[] = picked
    .map((id) => snap.players[id])
    .filter((p): p is PlayerProfile => Boolean(p) && p.visible !== false);

  // Normalize axes so the radar stays comparable across rosters/sessions.
  // Use career numbers (always present) and scale by the max across the
  // SELECTED players plus a small floor so a single zero doesn't crash.
  const careers = profiles.map((p) => p.career);
  const maxes = {
    winPct: 100, // already a percentage
    points: Math.max(1, ...careers.map((c) => c.points)),
    sweeps: Math.max(1, ...careers.map((c) => c.sweeps)),
    mini: Math.max(1, ...careers.map((c) => c.miniSweeps)),
    br: Math.max(1, ...careers.map((c) => c.breakAndRuns)),
    eob: Math.max(1, ...careers.map((c) => c.eightOnBreaks)),
  };

  const radarPlayers = profiles.map((p, i) => ({
    id: p.id,
    name: p.name,
    color: RADAR_COLORS[i % RADAR_COLORS.length],
    values: [
      p.career.winPct / maxes.winPct,
      p.career.points / maxes.points,
      p.career.sweeps / maxes.sweeps,
      p.career.miniSweeps / maxes.mini,
      p.career.breakAndRuns / maxes.br,
      p.career.eightOnBreaks / maxes.eob,
    ],
  }));

  return (
    <>
      <PageHeader
        eyebrow="Side by Side"
        title="Compare Players"
        subtitle={
          profiles.length > 0
            ? `${profiles.map((p) => p.name).join(" · ")} — career stats`
            : "Pick up to 4 players to overlay their career stats"
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/roster"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--fg-dim)] hover:text-[var(--color-brass)]"
        >
          <ArrowLeft size={14} /> Back to roster
        </Link>

        {/* Picker — click a tile to add/remove the player */}
        <section className="surface mb-8 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
              {picked.length === 0
                ? "Pick players"
                : `${picked.length}/${MAX_PICKS} selected`}
            </p>
            {picked.length > 0 && (
              <Link
                href="/compare"
                className="text-[11px] uppercase tracking-[0.18em] text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)]"
              >
                Reset
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {roster.map((p) => {
              const active = picked.includes(p.id);
              const nextPicks = active
                ? picked.filter((id) => id !== p.id)
                : picked.length >= MAX_PICKS
                  ? picked
                  : [...picked, p.id];
              const href = buildPicksHref(nextPicks);
              const disabled = !active && picked.length >= MAX_PICKS;
              return (
                <li key={p.id}>
                  <Link
                    href={href}
                    aria-disabled={disabled}
                    className={`group flex items-center gap-2.5 rounded-xl border p-2.5 transition-colors ${
                      active
                        ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10"
                        : disabled
                          ? "pointer-events-none border-[var(--border)] opacity-40"
                          : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-soft)]"
                    }`}
                  >
                    <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--color-brass)]/40 bg-[var(--color-felt-deep)] text-[10px] font-semibold text-[var(--color-cream)]">
                      {p.profileImage ? (
                        <Image src={p.profileImage} alt={p.name} fill sizes="36px" className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          {(p.name.match(/\b\w/g) ?? []).slice(0, 2).join("")}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {p.name}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-dim)]">
                        {p.skillLevel ? `SL${p.skillLevel}` : "—"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {profiles.length === 0 ? (
          <RackSkeleton message="Pick at least one player to start comparing" />
        ) : (
          <>
            <section className="surface mb-8 p-6">
              <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
                <StatRadar axes={[...AXES]} players={radarPlayers} />
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
                    Legend
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {profiles.map((p, i) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{
                            background: RADAR_COLORS[i % RADAR_COLORS.length],
                          }}
                        />
                        <Link
                          href={`/roster/${p.id}`}
                          className="hover:text-[var(--color-brass)]"
                        >
                          {p.name}
                        </Link>
                        <span className="text-xs text-[var(--fg-dim)]">
                          ({p.career.winPct}% · {p.career.points}pt)
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="pt-2 text-[10px] text-[var(--fg-dim)]">
                    Axes are normalized to the highest value among picked
                    players, so the polygon shows relative strength.
                  </p>
                </div>
              </div>
            </section>

            <section className="surface overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                    <th className="px-4 py-3">Stat</th>
                    {profiles.map((p) => (
                      <th key={p.id} className="px-4 py-3 text-right">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STAT_ROWS.map((row) => {
                    const values = profiles.map((p) => row.value(p));
                    const best = row.higherIsBetter
                      ? Math.max(...values)
                      : Math.min(...values);
                    return (
                      <tr
                        key={row.label}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-4 py-3 font-medium text-[var(--fg-dim)]">
                          {row.label}
                        </td>
                        {profiles.map((p, i) => {
                          const v = values[i];
                          const isBest = profiles.length > 1 && v === best;
                          return (
                            <td
                              key={p.id}
                              className={`px-4 py-3 text-right tabular-nums ${
                                isBest
                                  ? "font-bold text-[var(--color-brass-bright)]"
                                  : "text-[var(--fg)]"
                              }`}
                            >
                              {row.format(v)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </>
  );
}

const STAT_ROWS: Array<{
  label: string;
  value: (p: PlayerProfile) => number;
  format: (n: number) => string;
  higherIsBetter: boolean;
}> = [
  {
    label: "Matches",
    value: (p) => p.career.matchesPlayed,
    format: (n) => `${n}`,
    higherIsBetter: true,
  },
  {
    label: "Record",
    value: (p) => p.career.wins,
    format: (n) => `${n}`,
    higherIsBetter: true,
  },
  {
    label: "Win %",
    value: (p) => p.career.winPct,
    format: (n) => `${n}%`,
    higherIsBetter: true,
  },
  {
    label: "Points",
    value: (p) => p.career.points,
    format: (n) => `${n}`,
    higherIsBetter: true,
  },
  {
    label: "Sweeps",
    value: (p) => p.career.sweeps,
    format: (n) => `${n}`,
    higherIsBetter: true,
  },
  {
    label: "Mini-Sweeps",
    value: (p) => p.career.miniSweeps,
    format: (n) => `${n}`,
    higherIsBetter: true,
  },
  {
    label: "Break & Runs",
    value: (p) => p.career.breakAndRuns,
    format: (n) => `${n}`,
    higherIsBetter: true,
  },
  {
    label: "8-on-Break",
    value: (p) => p.career.eightOnBreaks,
    format: (n) => `${n}`,
    higherIsBetter: true,
  },
  {
    label: "Level Ups",
    value: (p) => p.career.levelUps,
    format: (n) => `${n}`,
    higherIsBetter: true,
  },
];
