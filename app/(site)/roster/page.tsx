import { RosterView } from "./view";

export { metadata } from "./view";
export const revalidate = 3600;

export default function RosterPage() {
  return <RosterView query={{}} />;
}
