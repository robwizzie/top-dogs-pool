import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { REVALIDATE_SECRET } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? req.nextUrl.searchParams.get("secret");
  if (!REVALIDATE_SECRET || auth !== `Bearer ${REVALIDATE_SECRET}` && auth !== REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  revalidateTag("apa");
  revalidateTag("youtube");
  return NextResponse.json({ ok: true, revalidated: ["apa", "youtube"] });
}
