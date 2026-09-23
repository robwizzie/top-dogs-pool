import { fromSegment } from "@/lib/query-segment";
import { MatchView } from "../../view";

export { generateMetadata } from "../../view";
export const revalidate = 3600;

/** Rendered on first request per value, then cached — see lib/query-segment. */
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ matchId: string; team: string }> };

export default async function MatchQueryPage({ params }: Props) {
  const { team } = await params;
  return <MatchView params={params} query={{ team: fromSegment(team) }} />;
}
