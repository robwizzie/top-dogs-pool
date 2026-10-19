import { fromSegment, withSessionRobots } from "@/lib/query-segment";
import { prerenderSessionSegments } from "@/lib/prerender";
import { StandingsView, metadata } from "../../view";

export const revalidate = 3600;

/** "all" + each single session are prerendered on Workers; combinations render on demand. */
export async function generateStaticParams() {
  return (await prerenderSessionSegments()).map((session) => ({ session }));
}

type Props = { params: Promise<{ session: string }> };

export async function generateMetadata({ params }: Props) {
  const { session } = await params;
  return withSessionRobots(metadata, session);
}

export default async function StandingsQueryPage({ params }: Props) {
  const { session } = await params;
  return <StandingsView query={{ session: fromSegment(session) }} />;
}
