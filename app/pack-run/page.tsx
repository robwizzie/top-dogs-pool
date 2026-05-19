import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import { PackRunner } from "@/components/shots/PackRunner";

export const metadata = {
  title: "Pack Run — Top Dogs Pool",
  description:
    "Build a custom session: pick any shots, set how many reps you'll take of each, and run them with the pack.",
};

export default function PackRunPage() {
  return (
    <main className="min-h-dvh bg-[var(--bg)]">
      <PackRunner shots={KINISTER_SHOTS} />
    </main>
  );
}
