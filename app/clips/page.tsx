import { PageHeader } from "@/components/ui/Section";
import { YouTubeEmbed } from "@/components/clips/YouTubeEmbed";
import { getClips } from "@/lib/youtube/client";
import { Video } from "lucide-react";

export const revalidate = 1800;

export const metadata = {
  title: "Clips",
  description: "Highlights from Top Dogs matches.",
};

export default async function ClipsPage() {
  const clips = await getClips();
  return (
    <>
      <PageHeader
        eyebrow="Highlights"
        title="Clips"
        subtitle={
          clips.length
            ? `${clips.length} clip${clips.length === 1 ? "" : "s"} from match nights.`
            : "Highlights from match nights."
        }
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {clips.length === 0 ? (
          <div className="surface flex items-center gap-3 p-6 text-sm text-[var(--fg-dim)]">
            <Video size={18} />
            Clips will appear here once the YouTube playlist is connected. Set{" "}
            <code className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5 text-xs">
              YOUTUBE_API_KEY
            </code>{" "}
            and{" "}
            <code className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5 text-xs">
              YOUTUBE_PLAYLIST_ID
            </code>{" "}
            to go live.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {clips.map((c, i) => (
              <YouTubeEmbed key={c.id} clip={c} priority={i === 0} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
