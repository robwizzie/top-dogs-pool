import Link from "next/link";
import { PoolBall } from "@/components/brand/PoolBall";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <PoolBall number={8} size={120} />
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-6xl tracking-wide">
        Scratch.
      </h1>
      <p className="mt-3 text-[var(--fg-dim)]">
        That page is in the pocket — but not the one you wanted. Let&apos;s rack &apos;em up again.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-brass)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-brass-bright)]"
      >
        Back to the table
      </Link>
    </div>
  );
}
