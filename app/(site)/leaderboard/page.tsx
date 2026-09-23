import { LeaderboardView } from "./view";

export { metadata } from "./view";
export const revalidate = 3600;

export default function LeaderboardPage() {
  return <LeaderboardView query={{}} />;
}
