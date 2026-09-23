import { fromSegment } from "@/lib/query-segment";
import { PublicBriefingView } from "../../view";

export { metadata } from "../../view";
export const revalidate = 3600;

/** Rendered on first request per value, then cached — see lib/query-segment. */
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ available: string }> };

export default async function PublicBriefingQueryPage({ params }: Props) {
  const { available } = await params;
  return <PublicBriefingView query={{ available: fromSegment(available) }} />;
}
