import { PoolBall } from "@/components/brand/PoolBall";

/**
 * Loading / empty placeholder built out of a triangular rack of pool balls.
 * Balls "break" outward on mount via CSS keyframes (subtle drift + rotation).
 * Use as a Suspense fallback or anywhere we'd otherwise show a generic
 * spinner / "no data" block.
 */
export function RackSkeleton({
  message,
  size = "md",
}: {
  message?: string;
  size?: "sm" | "md" | "lg";
}) {
  const ballSize = size === "sm" ? 22 : size === "lg" ? 44 : 32;
  const gap = size === "sm" ? 2 : size === "lg" ? 4 : 3;
  // 5 rows: 5+4+3+2+1 = 15 balls. The 8 ball lives at the center of row 3
  // (apex would be more dramatic; mid-rack is the classic 8-ball break).
  // Numbers chosen so adjacent balls don't share a color where possible.
  const rows: number[][] = [
    [1, 11, 2, 12, 3],
    [13, 4, 14, 5],
    [6, 8, 15],
    [7, 9],
    [10],
  ];

  // A jitter table — each ball gets a stable break vector so the animation
  // looks chaotic but reproducible per render.
  let i = 0;
  return (
    <div className="rack-skeleton flex flex-col items-center gap-3 py-8">
      <div
        className="relative grid place-items-center"
        style={{ rowGap: gap, columnGap: gap }}
      >
        {rows.map((row, rIdx) => (
          <div key={rIdx} className="flex" style={{ gap }}>
            {row.map((n) => {
              const idx = i++;
              const angle = (idx * 137.5) % 360; // golden-angle scatter
              const dist = 18 + (idx % 5) * 6;
              const dx = Math.cos((angle * Math.PI) / 180) * dist;
              const dy = Math.sin((angle * Math.PI) / 180) * dist;
              const delay = (idx % 7) * 80;
              return (
                <span
                  key={`${rIdx}-${n}`}
                  className="rack-ball"
                  style={{
                    // CSS custom props consumed by the keyframe.
                    ["--rb-dx" as string]: `${dx}px`,
                    ["--rb-dy" as string]: `${dy}px`,
                    ["--rb-rot" as string]: `${(idx % 2 ? 1 : -1) * 25}deg`,
                    animationDelay: `${delay}ms`,
                  }}
                >
                  <PoolBall number={n} size={ballSize} />
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {message && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
          {message}
        </p>
      )}
    </div>
  );
}
