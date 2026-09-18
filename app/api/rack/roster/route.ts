import { NextResponse } from "next/server";
import { getAllPlayersBrief } from "@/lib/apa";

/**
 * The APA roster, as {id, name} pairs, for the Rack Up profile linker.
 *
 * Only names and member numbers that the site already publishes on /roster —
 * nothing here is private, and it's the same list the roster page renders.
 * It exists as an endpoint because the profile editor is a client component
 * and the roster lives in a server-side snapshot.
 */
export const revalidate = 3600;

export async function GET() {
  try {
    const players = await getAllPlayersBrief();
    return NextResponse.json({ players });
  } catch {
    // The section still works unlinked if the snapshot hasn't been generated.
    return NextResponse.json({ players: [] });
  }
}
