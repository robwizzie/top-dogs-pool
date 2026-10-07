import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LockScreen } from "@/components/ui/LockScreen";
import { ADMIN_COOKIE, sha256 } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin · Locked", robots: { index: false, follow: false } };

const SAFE_PREFIX = "/leaderboard/admin";
const safePath = (next: string | undefined) =>
  next && next.startsWith(SAFE_PREFIX) ? next : SAFE_PREFIX;

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const safeNext = safePath(sp.next);

  async function login(formData: FormData) {
    "use server";
    const submitted = String(formData.get("password") ?? "");
    const safe = safePath(String(formData.get("next") ?? SAFE_PREFIX));
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || submitted !== expected) {
      redirect(`/admin-login?next=${encodeURIComponent(safe)}&error=1`);
    }
    const jar = await cookies();
    jar.set(ADMIN_COOKIE, await sha256(expected), {
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
      title="Admin is locked"
      passwordLabel="Admin password"
      submitLabel="Unlock admin"
      action={login}
      next={safeNext}
      error={!!sp.error}
      blurb={
        <>
          Adding tournament results changes the leaderboard — it&apos;s behind a
          team password so only Top Dawgs can post scores and patches.
        </>
      }
    />
  );
}
