import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  loadTournamentFile,
  writeTournamentFile,
  TournamentResult,
} from "@/lib/apa/tournaments";
import { Format } from "@/lib/apa/schemas";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Incoming new game — id is assigned server-side. */
const NewGame = z.object({
  name: z.string().min(1).max(120),
  date: z.string().min(1),
  sessionId: z.number().int(),
  format: Format.default("8-ball"),
  results: z.array(TournamentResult).min(1),
});

function genId(): string {
  return `tny_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdminAuthed()) return null;
  return NextResponse.json(
    {
      ok: false,
      error:
        "unauthorized — sign in at /admin-login (or set ADMIN_PASSWORD in production)",
    },
    { status: 401 },
  );
}

/** GET — list all tournament games (admin only). */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const file = await loadTournamentFile();
  return NextResponse.json({ ok: true, games: file.games });
}

/** POST — add one tournament game. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const parsed = NewGame.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const file = await loadTournamentFile();
  const game = { id: genId(), ...parsed.data };
  file.games.push(game);

  try {
    await writeTournamentFile(file);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `failed to save: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  revalidatePath("/leaderboard");
  return NextResponse.json({ ok: true, game });
}

/** DELETE — remove a game by id (?id=…). */
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  }

  const file = await loadTournamentFile();
  const before = file.games.length;
  file.games = file.games.filter((g) => g.id !== id);
  if (file.games.length === before) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  try {
    await writeTournamentFile(file);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `failed to save: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  revalidatePath("/leaderboard");
  return NextResponse.json({ ok: true, removed: id });
}
