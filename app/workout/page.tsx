import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import { WorkoutRunner } from "@/components/shots/WorkoutRunner";

export default function WorkoutPage() {
  return (
    <main className="min-h-dvh bg-[var(--bg)]">
      <WorkoutRunner shots={KINISTER_SHOTS} />
    </main>
  );
}
