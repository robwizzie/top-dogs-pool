import { fromSegment, withSessionRobots } from "@/lib/query-segment";
import { prerenderPlayerIds, prerenderSessionSegments } from "@/lib/prerender";
import { PlayerView, generateMetadata as playerMetadata } from "../../view";

export const revalidate = 3600;

/**
 * Each player × ("all" + each single session) is prerendered on Workers;
 * multi-session combinations render on demand.
 */
export async function generateStaticParams() {
  const [playerIds, sessions] = await Promise.all([
    prerenderPlayerIds(),
    prerenderSessionSegments(),
  ]);
  return playerIds.flatMap((playerId) =>
    sessions.map((session) => ({ playerId, session })),
  );
}

type Props = { params: Promise<{ playerId: string; session: string }> };

export async function generateMetadata({ params }: Props) {
  const { session } = await params;
  return withSessionRobots(await playerMetadata({ params }), session);
}

export default async function PlayerQueryPage({ params }: Props) {
  const { session } = await params;
  return <PlayerView params={params} query={{ session: fromSegment(session) }} />;
}
