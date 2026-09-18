import { notFound } from "next/navigation";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/rack/config";
import { RACK_CONFIGURED } from "@/lib/rack/supabase/env";
import { TvDisplay } from "@/components/rack/TvDisplay";

export const metadata = {
  title: "Live scoreboard",
  // A TV left on a scoreboard shouldn't turn up in search results.
  robots: { index: false, follow: false },
};

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const clean = normalizeRoomCode(code);
  if (!isValidRoomCode(clean) || !RACK_CONFIGURED) notFound();
  return <TvDisplay code={clean} />;
}
