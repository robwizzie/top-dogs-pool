import Link from "next/link";
import Image from "next/image";
import type { Player } from "@/lib/apa/schemas";
import { CueBall, PoolBall } from "@/components/brand/PoolBall";
import { cn } from "@/lib/utils";

export function PlayerCard({ player, index = 0 }: { player: Player; index?: number }) {
  const skill = player.skillLevel ?? null;
  const initials = player.name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="fade-in-up" style={{ animationDelay: `${index * 40}ms` }}>
      <Link
        href={`/roster/${player.id}`}
        className="group surface surface-hover relative block overflow-hidden p-5 transition-all"
      >
        <div className="absolute -right-6 -top-6 opacity-30 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-50">
          {skill ? <PoolBall number={skill} size={120} /> : <CueBall size={120} />}
        </div>

        <div className="relative flex items-center gap-4">
          <div
            className={cn(
              "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-brass)]/40 bg-[var(--color-felt-deep)] text-lg font-semibold tracking-wider text-[var(--color-cream)]",
            )}
          >
            {player.profileImage ? (
              <Image
                src={player.profileImage}
                alt={player.name}
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              initials || "?"
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass)]">
              {player.format !== "unknown" ? player.format : "Player"}
            </p>
            <h3 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
              {player.name}
            </h3>
          </div>
        </div>

        <div className="relative mt-5 flex items-end justify-between gap-3">
          {player.stats?.winPct !== undefined &&
          player.stats?.matchesPlayed ? (
            <div className="text-xs text-[var(--fg-dim)]">
              <span className="font-semibold text-[var(--color-cream)]">
                {player.stats.wins ?? 0}
                <span className="text-[var(--fg-dim)]">/</span>
                {player.stats.matchesPlayed}
              </span>{" "}
              · {player.stats.winPct}%
              {player.stats.points !== undefined && player.stats.points > 0 && (
                <>
                  {" "}
                  · {player.stats.points}pt
                </>
              )}
            </div>
          ) : (
            <span className="text-xs text-[var(--fg-dim)]">View profile →</span>
          )}
          {skill !== null && (
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1 text-[11px] font-semibold tracking-wider text-[var(--color-brass-bright)]">
              SL {skill}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
