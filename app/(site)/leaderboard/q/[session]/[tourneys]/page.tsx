import { NO_VALUE, fromSegment, withSessionRobots } from "@/lib/query-segment";
import { prerenderSessionSegments } from "@/lib/prerender";
import { LeaderboardView, metadata } from "../../../view";

export const revalidate = 3600;

/**
 * "all" + each single session (league-only) are prerendered on Workers;
 * tournament variants and combinations render on demand.
 */
export async function generateStaticParams() {
  return (await prerenderSessionSegments()).map((session) => ({
    session,
    tourneys: NO_VALUE,
  }));
}

type Props = { params: Promise<{ session: string; tourneys: string }> };

export async function generateMetadata({ params }: Props) {
  const { session } = await params;
  return withSessionRobots(metadata, session);
}

export default async function LeaderboardQueryPage({ params }: Props) {
  const { session, tourneys } = await params;
  return (
    <LeaderboardView
      query={{ session: fromSegment(session), tourneys: fromSegment(tourneys) }}
    />
  );
}
