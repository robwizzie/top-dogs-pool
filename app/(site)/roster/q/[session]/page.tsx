import { fromSegment } from "@/lib/query-segment";
import { RosterView } from "../../view";

export { metadata } from "../../view";
export const revalidate = 3600;

/** Rendered on first request per value, then cached — see lib/query-segment. */
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ session: string }> };

export default async function RosterQueryPage({ params }: Props) {
  const { session } = await params;
  return <RosterView query={{ session: fromSegment(session) }} />;
}
