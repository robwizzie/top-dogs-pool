import { fromSegment } from "@/lib/query-segment";
import { LeaderboardView } from "../../../view";

export { metadata } from "../../../view";
export const revalidate = 3600;

/** Rendered on first request per value, then cached — see lib/query-segment. */
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ session: string; tourneys: string }> };

export default async function LeaderboardQueryPage({ params }: Props) {
  const { session, tourneys } = await params;
  return (
    <LeaderboardView
      query={{ session: fromSegment(session), tourneys: fromSegment(tourneys) }}
    />
  );
}
