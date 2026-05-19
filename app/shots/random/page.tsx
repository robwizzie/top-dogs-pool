import { redirect } from "next/navigation";
import { KINISTER_SHOTS } from "@/lib/kinister/shots";

// Disable static rendering so a fresh random pick happens on every request.
export const dynamic = "force-dynamic";

/**
 * "Surprise me" route — bounces to a random shot detail page. Linked from
 * the home Training card and anywhere else that wants a quick lottery.
 */
export default function RandomShotPage() {
  const idx = Math.floor(Math.random() * KINISTER_SHOTS.length);
  const shot = KINISTER_SHOTS[idx];
  redirect(`/shots/${shot.id}`);
}
