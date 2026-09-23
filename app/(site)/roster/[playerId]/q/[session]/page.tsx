import { fromSegment } from "@/lib/query-segment";
import { PlayerView } from "../../view";

export { generateMetadata } from "../../view";
export const revalidate = 3600;

/** Rendered on first request per value, then cached — see lib/query-segment. */
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ playerId: string; session: string }> };

export default async function PlayerQueryPage({ params }: Props) {
  const { session } = await params;
  return <PlayerView params={params} query={{ session: fromSegment(session) }} />;
}
