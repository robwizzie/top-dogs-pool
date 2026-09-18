import { NextResponse } from "next/server";
import { getAnyPlayerProfile } from "@/lib/apa";

/**
 * One roster player's importable details, for a newly linked Rack Up account:
 * display name, current skill level and the team photo.
 *
 * Everything returned here is already published on /roster/<id>, so there is
 * nothing to gate. The link itself is what's protected — approving a claim,
 * which happens in the database, not here.
 */
export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { profile, isOpponent } = await getAnyPlayerProfile(id);
    // Opponent players are in the snapshot too. They are emphatically not
    // claimable — only our own roster.
    if (!profile || isOpponent || profile.visible === false) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: profile.id,
      // A nickname is what the team actually calls them, so prefer it.
      name: profile.nickname || profile.name,
      skillLevel: profile.currentSkillLevel,
      // Which game that skill level is for — APA rates the two separately and
      // importing an 8-ball level as a 9-ball one would set the wrong race.
      format: profile.format,
      profileImage: profile.profileImage ?? null,
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
