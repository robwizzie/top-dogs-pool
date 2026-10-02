import { PlayerView } from "./view";
import { prerenderPlayerIds } from "@/lib/prerender";

export { generateMetadata } from "./view";
export const revalidate = 3600;

/**
 * Rendered on first request per id, then cached — except on Cloudflare
 * Workers, where they are prerendered at build (see lib/prerender.ts).
 */
export async function generateStaticParams() {
  return (await prerenderPlayerIds()).map((playerId) => ({ playerId }));
}

type Props = { params: Promise<{ playerId: string }> };

export default function PlayerPage({ params }: Props) {
  return <PlayerView params={params} query={{}} />;
}
