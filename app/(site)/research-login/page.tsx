import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LockScreen } from "@/components/ui/LockScreen";

export const dynamic = "force-dynamic";

export const metadata = { title: "Research · Locked", robots: { index: false, follow: false } };

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
    <LockScreen
      title="Research is locked"
      passwordLabel="Team password"
      submitLabel="Unlock research"
      action={login}
      next={safeNext}
      error={!!sp.error}
      blurb={
        <>
          Scouting reports, counter-picks, and lineup math live behind a team
          password. Opponents don&apos;t need to know how to beat us.
        </>
      }
    />
  );
}
