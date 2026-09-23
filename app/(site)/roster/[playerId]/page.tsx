import { PlayerView } from "./view";

export { generateMetadata } from "./view";
export const revalidate = 3600;

/** Rendered on first request per id, then cached. */
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ playerId: string }> };

export default function PlayerPage({ params }: Props) {
  return <PlayerView params={params} query={{}} />;
}
