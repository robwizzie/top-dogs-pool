import { MatchView } from "./view";
import { prerenderMatchIds } from "@/lib/prerender";

export { generateMetadata } from "./view";
export const revalidate = 3600;

/**
 * Rendered on first request per id, then cached — except on Cloudflare
 * Workers, where they are prerendered at build (see lib/prerender.ts).
 */
export async function generateStaticParams() {
  return (await prerenderMatchIds()).map((matchId) => ({ matchId }));
}

type Props = { params: Promise<{ matchId: string }> };

export default function MatchPage({ params }: Props) {
  return <MatchView params={params} query={{}} />;
}
