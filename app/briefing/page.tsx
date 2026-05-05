import { PageHeader } from "@/components/ui/Section";
import {
  TeamBriefing,
  type BriefingInputs,
} from "@/components/research/TeamBriefing";
import {
  getOpponentTeams,
  getRoster,
  getSchedule,
} from "@/lib/apa";
import { loadSnapshot } from "@/lib/apa/client";
import {
  nextMatchBriefing,
  opponentScoutingReport,
} from "@/lib/research";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Team briefing",
  description:
    "Pre-match briefing for the team — opponent intel, suggested lineup, and threats to watch.",
};

type Props = {
  searchParams: Promise<{ available?: string }>;
};

/**
 * Public-facing briefing page (NOT under the /research password gate so
 * the captain can share the link with the rest of the team). Renders the
 * same shared TeamBriefing component as the captain's view, but in
 * read-only mode — no availability toggles, no share button.
 *
 * The captain's `?available=` query param locks the lineup to the
 * specific players they marked in. If absent, defaults to all visible
 * roster.
 */
export default async function PublicBriefingPage({ searchParams }: Props) {
  const { available: availableQuery } = await searchParams;

  const [snapshot, schedule, roster, oppTeams] = await Promise.all([
    loadSnapshot(),
    getSchedule(),
    getRoster(),
    getOpponentTeams(),
  ]);

  const matches = Object.values(snapshot.matches ?? {});
  const briefing = nextMatchBriefing(schedule, matches, roster);
  if (!briefing) {
    return (
      <>
        <PageHeader
          eyebrow="Team briefing"
          title="No upcoming match"
          subtitle="Check back after the next match is scheduled."
        />
      </>
    );
  }

  // Pull together the rest of the briefing inputs.
  const oppTeam =
    oppTeams.find(
      (t) =>
        t.name.trim().toLowerCase() ===
        briefing.opponentName.trim().toLowerCase(),
    ) ?? null;
  const scouting = opponentScoutingReport(
    briefing.opponentName,
    matches,
    roster,
    snapshot.currentSession?.id,
    snapshot.opponentPlayers,
  );

  // Build opp roster for the lineup engine — prefer scraped opp profile
  // (richer, includes preferredPosition); fall back to scouting report.
  const opponentRoster = oppTeam
    ? oppTeam.roster.map((p) => ({
        name: p.name,
        latestSL: p.skillLevel,
        preferredPosition: undefined,
      }))
    : scouting.players.map((p) => ({
        name: p.name,
        latestSL: p.latestSL,
        preferredPosition: p.preferredPosition,
      }));

  const inputs: BriefingInputs = {
    matches,
    roster,
    opponentTeam: briefing.opponentName,
    opponentRoster,
    location: briefing.match.location,
  };

  // Resolve initial availability from the query param. Falls back to ALL
  // visible roster when absent (so a bare /briefing URL still shows a
  // sensible default lineup).
  const visibleRoster = roster.filter((p) => p.visible !== false);
  const initialAvailableIds = (() => {
    if (!availableQuery) return visibleRoster.map((p) => p.id);
    const ids = availableQuery
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return visibleRoster.map((p) => p.id);
    return ids;
  })();

  return (
    <>
      <PageHeader
        eyebrow="Pre-match briefing"
        title="Tonight's read"
        subtitle="Shared from the captain — opponent intel + suggested lineup based on who's playing."
      />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <TeamBriefing
          briefing={briefing}
          scouting={scouting}
          oppTeam={oppTeam}
          inputs={inputs}
          initialAvailableIds={initialAvailableIds}
          editable={false}
        />
      </div>
    </>
  );
}
