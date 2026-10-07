import { notFound } from "next/navigation";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/rack/config";
import { RoomView } from "@/components/rack/RoomView";

// Rooms are short-lived and shared by link in a group chat: the preview gets
// Rack Up's card, but search engines shouldn't keep stale tables around.
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return {
    title: `Table ${normalizeRoomCode(code)}`,
    robots: { index: false, follow: false },
  };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const clean = normalizeRoomCode(code);
  if (!isValidRoomCode(clean)) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <RoomView code={clean} />
    </div>
  );
}
