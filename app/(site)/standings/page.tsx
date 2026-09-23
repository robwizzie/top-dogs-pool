import { StandingsView } from "./view";

export { metadata } from "./view";
export const revalidate = 3600;

export default function StandingsPage() {
  return <StandingsView query={{}} />;
}
