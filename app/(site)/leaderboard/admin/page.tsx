import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { TournamentForm } from "@/components/leaderboard/TournamentForm";
import {
  getAllPlayersBrief,
  getCurrentSession,
  getSessions,
} from "@/lib/apa";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add Tournament Results",
  description:
    "Manually add tournament games, patches, and scores to the Top Dawgs Patch Watch leaderboard.",
};

export default async function TournamentAdminPage() {
  const [sessions, currentSession, players] = await Promise.all([
    getSessions(),
    getCurrentSession(),
    getAllPlayersBrief(),
  ]);

  const adminConfigured = !!process.env.ADMIN_PASSWORD;

  return (
    <>
      <PageHeader
        eyebrow="Patch Watch · Admin"
        title="Add Tournament Results"
        subtitle="Tournament games live in a separate app we can't scrape — add them here and they fold straight into the leaderboard."
      />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/leaderboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
        >
          <ArrowLeft size={15} />
          Back to Patch Watch
        </Link>

        {!adminConfigured && (
          <div className="surface mb-6 border-l-2 border-[var(--color-brass)] p-4 text-sm text-[var(--fg-dim)]">
            <strong className="text-[var(--fg)]">Heads up:</strong> no{" "}
            <code className="text-[var(--color-brass-bright)]">ADMIN_PASSWORD</code>{" "}
            is set. This page is open in development, but saving is blocked in
            production until you set one. Entries are written to{" "}
            <code>data/tournaments.json</code> — commit that file (or mount a
            volume at <code>/app/data</code>) so they survive a redeploy.
          </div>
        )}

        <TournamentForm
          sessions={sessions}
          currentSessionId={currentSession?.id ?? sessions[0]?.id ?? null}
          players={players}
        />
      </div>
    </>
  );
}
