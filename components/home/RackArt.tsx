import { PoolBall } from "@/components/brand/PoolBall";
import { cn } from "@/lib/utils";

// A legal 8-ball rack: 1 at the apex, 8 in the middle of the third row,
// a stripe and a solid in the back corners.
const ROWS = [[1], [9, 2], [10, 8, 3], [11, 7, 14, 4], [5, 13, 15, 6, 12]];

/** A full rack of fifteen inside a wooden triangle, viewed from above. */
export function RackArt({ ball = 52, className }: { ball?: number; className?: string }) {
  const R = ball / 2;
  const rowH = ball * (Math.sqrt(3) / 2);
  const stroke = ball * 0.32;

  // Triangle through the outer ball centres (side = 4 balls), then pushed out
  // so its inner edge just touches the balls. For an equilateral triangle,
  // moving every edge out by d grows the inradius by d.
  const side = 4 * ball;
  const inradius = side / (2 * Math.sqrt(3));
  const grow = (inradius + R + stroke / 2 + 1) / inradius;
  const margin = stroke + R; // room for the frame outside the balls

  // Centre-triangle vertices in a local frame with the apex ball at (0, 0).
  const cx = (x: number) => x + 2 * ball + margin * 2;
  const cy = (y: number) => y + margin * 2;
  const centres = [
    [0, 0],
    [-2 * ball, 4 * rowH],
    [2 * ball, 4 * rowH],
  ];
  const g = [0, (8 * rowH) / 3]; // centroid
  const frame = centres.map(([x, y]) => [g[0] + (x - g[0]) * grow, g[1] + (y - g[1]) * grow]);

  const w = 4 * ball + margin * 4;
  const h = 4 * rowH + margin * 4 + R;
  const points = frame.map(([x, y]) => `${cx(x)},${cy(y)}`).join(" ");

  return (
    <div className={cn("relative", className)} style={{ width: w, height: h }} aria-hidden>
      {/* contact shadow on the felt */}
      <div className="absolute inset-x-[10%] bottom-[2%] top-[25%] rounded-[40%] bg-black/50 blur-2xl" />
      <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 overflow-visible">
        <defs>
          <linearGradient id="rack-wood" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#8a5530" />
            <stop offset="0.5" stopColor="#4a2a14" />
            <stop offset="1" stopColor="#2a170a" />
          </linearGradient>
        </defs>
        <polygon points={points} fill="none" stroke="url(#rack-wood)" strokeWidth={stroke} strokeLinejoin="round" />
        <polygon points={points} fill="none" stroke="rgba(255,220,170,0.28)" strokeWidth={1} strokeLinejoin="round" />
      </svg>
      {ROWS.map((row, r) =>
        row.map((n, i) => (
          <span
            key={n}
            className="absolute drop-shadow-[0_6px_6px_rgba(0,0,0,0.55)]"
            style={{ left: cx((i - r / 2) * ball) - R, top: cy(r * rowH) - R }}
          >
            <PoolBall number={n} size={ball} className="block" />
          </span>
        )),
      )}
    </div>
  );
}
