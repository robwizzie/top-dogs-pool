import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Lock } from "lucide-react";
import { PoolBall } from "@/components/brand/PoolBall";

export const dynamic = "force-dynamic";

export const metadata = { title: "Research · Locked" };

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default async function ResearchLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const safeNext = sp.next && sp.next.startsWith("/research") ? sp.next : "/research";

  async function login(formData: FormData) {
    "use server";
    const submitted = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "/research");
    const expected = process.env.RESEARCH_PASSWORD;
    const safe = next.startsWith("/research") ? next : "/research";
    if (!expected || submitted !== expected) {
      redirect(`/research-login?next=${encodeURIComponent(safe)}&error=1`);
    }
    const token = await sha256(expected);
    const jar = await cookies();
    jar.set("td_research", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    redirect(safe);
  }

  return (
    <main className="relative mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute -right-10 top-0 opacity-15" aria-hidden>
        <PoolBall number={8} size={220} />
      </div>
      <div className="surface relative w-full overflow-hidden p-8">
        <span aria-hidden className="block h-px w-12 bg-gradient-to-r from-[var(--color-brass)] to-transparent" />
        <div className="mt-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          <Lock size={12} />
          Top Dawgs only
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">
          Research is locked
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fg-dim)]">
          Scouting reports, counter-picks, and lineup math live behind a team
          password. Opponents don&apos;t need to know how to beat us.
        </p>

        <form action={login} className="mt-6 space-y-3">
          <input type="hidden" name="next" value={safeNext} />
          <label className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
            Team password
            <input
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 font-sans text-base normal-case tracking-normal text-[var(--fg)] outline-none transition-colors focus:border-[var(--color-brass)] focus:ring-2 focus:ring-[var(--color-brass)]/40"
            />
          </label>
          {sp.error && (
            <p className="text-xs text-[var(--color-pop-bright)]">
              That password didn&apos;t match. Try again.
            </p>
          )}
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brass)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)]"
          >
            Unlock research
          </button>
        </form>
      </div>
    </main>
  );
}
