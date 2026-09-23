import { PublicBriefingView } from "./view";

export { metadata } from "./view";
export const revalidate = 3600;

export default function PublicBriefingPage() {
  return <PublicBriefingView query={{}} />;
}
