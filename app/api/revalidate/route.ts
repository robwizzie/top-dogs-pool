import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { REVALIDATE_SECRET } from "@/lib/config";

export const runtime = "nodejs";

/**
 * POST /api/revalidate — bust ISR caches after data/apa.json is regenerated.
 * Call this from CI right after `npm run scrape`.
 *
 *   curl -X POST -H "Authorization: Bearer $REVALIDATE_SECRET" \
 *        https://your-site.example.com/api/revalidate
 */
export async function POST(req: NextRequest) {
  const auth =
    req.headers.get("authorization") ?? req.nextUrl.searchParams.get("secret");
  const ok =
    REVALIDATE_SECRET &&
    (auth === `Bearer ${REVALIDATE_SECRET}` || auth === REVALIDATE_SECRET);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Bust the entire site (small footprint — every page reads from data/apa.json).
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, revalidated: "all" });
}
