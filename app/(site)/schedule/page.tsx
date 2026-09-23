import { ScheduleView } from "./view";

export { metadata } from "./view";
export const revalidate = 3600;

export default function SchedulePage() {
  return <ScheduleView query={{}} />;
}
