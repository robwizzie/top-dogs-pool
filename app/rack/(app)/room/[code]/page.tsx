import { notFound } from "next/navigation";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/rack/config";
import { RoomView } from "@/components/rack/RoomView";

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
