import { PageHeader, Section } from "@/components/ui/Section";
import { MatchCard } from "@/components/cards/MatchCard";
import { MatchHistoryEntry } from "@/components/schedule/MatchHistoryEntry";
import { ScheduleHeatmap } from "@/components/schedule/ScheduleHeatmap";
import { SessionPicker } from "@/components/leaderboard/SessionPicker";
import { HeaderRail } from "@/components/season/SeasonKit";
import { PointerSheen } from "@/components/home/PointerSheen";
import { formatDate } from "@/lib/utils";
import {
  getCurrentSession,
  getSchedule,
  getSessions,
} from "@/lib/apa";
import {
  parseSessionScope,
  resolveScope,
  scopeLabel,
} from "@/lib/session-scope";



export const metadata = {
  title: "Schedule",
  description: "Top Dawgs match schedule + recaps, by session.",
};

type Props = {
  query: { session?: string };
};

export async function ScheduleView({ query }: Props) {
  const { session } = query;
  const [sessions, currentSession] = await Promise.all([
    getSessions(),
    getCurrentSession(),
  ]);
  const allIds = sessions.map((s) => s.id);
  const scope = parseSessionScope(session, allIds);
  const selectedIds = resolveScope(scope, allIds, currentSession?.id);

  const schedule = await getSchedule(selectedIds);
  const sessionLabel = scopeLabel(selectedIds, sessions);
  const isCurrentOnly =
    selectedIds.size === 1 &&
    currentSession !== null &&
    selectedIds.has(currentSession.id);

  const now = Date.now();
  const upcoming = schedule
    .filter((m) => m.status === "upcoming" || new Date(m.date).getTime() >= now)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  // A future-dated bye is already in `upcoming`; don't list it under results too.
  const upcomingIds = new Set(upcoming.map((m) => m.id));
  const past = schedule
    .filter(
      (m) =>
        !upcomingIds.has(m.id) && (m.status === "completed" || m.status === "bye"),
    )
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  // Counters for summary header
  const completedCount = past.filter((m) => m.status === "completed").length;
  const wins = past.filter(
    (m) =>
      m.status === "completed" &&
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number" &&
      m.teamScore > m.opponentScore,
  ).length;
  const losses = past.filter(
    (m) =>
      m.status === "completed" &&
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number" &&
      m.teamScore < m.opponentScore,
  ).length;
  const ties = completedCount - wins - losses;
  const nextMatch = upcoming.find((m) => m.status !== "bye") ?? null;
  const winPct = completedCount ? Math.round((wins / completedCount) * 100) : null;

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title="Schedule"
        subtitle={
          completedCount > 0
            ? `${sessionLabel} · ${wins}–${losses}${ties ? `–${ties}` : ""} across ${completedCount} match${completedCount === 1 ? "" : "es"}`
            : `${sessionLabel} · ${schedule.length} match${schedule.length === 1 ? "" : "es"}`
        }
      >
        {schedule.length > 0 && (
          <HeaderRail
            cells={[
              {
                label: "Record",
                value: completedCount ? (
                  <>
                    {wins}
                    <span className="text-[var(--color-cream)]/30">–</span>
                    {losses}
                    {ties ? (
                      <>
                        <span className="text-[var(--color-cream)]/30">–</span>
                        {ties}
                      </>
                    ) : null}
                  </>
                ) : (
                  "—"
                ),
                accent: completedCount > 0 && wins > losses,
              },
              {
                label: "Win rate",
                value:
                  winPct !== null ? (
                    <>
                      {winPct}
                      <span className="text-[0.55em] text-[var(--color-cream)]/45">%</span>
                    </>
                  ) : (
                    "—"
                  ),
              },
              { label: "Played", value: completedCount, note: `of ${schedule.length} on the card` },
              ...(nextMatch
                ? [
                    {
                      label: "Up next",
                      value: (
                        <span className="text-2xl sm:text-[1.7rem]">vs {nextMatch.opponent}</span>
                      ),
                      note: formatDate(nextMatch.date),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </PageHeader>
      <PointerSheen />

      <div className="mx-auto max-w-7xl px-4 pb-2 pt-4 sm:px-6 lg:px-8">
        <SessionPicker
          basePath="/schedule"
          sessions={sessions}
          selectedIds={selectedIds}
          showAllTime={false}
        />
      </div>

      {schedule.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          <ScheduleHeatmap matches={schedule} />
        </div>
      )}

      {isCurrentOnly && (
        <Section
          eyebrow="Upcoming"
          title={upcoming.length ? `Next ${upcoming.length}` : "No upcoming matches"}
        >
          {upcoming.length === 0 ? (
            <p className="pm-glass p-6 text-sm text-[var(--color-cream)]/60">
              The session is wrapped — recaps below.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((m, i) => (
                <MatchCard key={m.id} match={m} highlight={i === 0} />
              ))}
            </div>
          )}
        </Section>
      )}

      <Section
        eyebrow={isCurrentOnly ? "Recaps" : "Match History"}
        title={isCurrentOnly ? "Results & Recaps" : "Matches"}
      >
        {past.length === 0 ? (
          <p className="pm-glass p-6 text-sm text-[var(--color-cream)]/60">
            No completed matches in this selection yet.
          </p>
        ) : (
          <ol className="space-y-3 sm:space-y-4">
            {past.map((m) => (
              <li key={m.id}>
                <MatchHistoryEntry match={m} />
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}
