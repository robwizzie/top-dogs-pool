import { MatchView } from "./view";

export { generateMetadata } from "./view";
export const revalidate = 3600;

/** Rendered on first request per id, then cached. */
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ matchId: string }> };

export default function MatchPage({ params }: Props) {
  return <MatchView params={params} query={{}} />;
}
