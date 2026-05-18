import type { DiamondCoord } from "@/lib/kinister/shots";
import { POCKETS } from "@/lib/kinister/shots";
import {
  BALL_R,
  POCKET_R,
  RAIL,
  SURFACE_H,
  SURFACE_W,
  SVG_H,
  SVG_W,
  UNIT,
  toSvg,
} from "@/lib/kinister/geometry";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  cueBall?: DiamondCoord;
  objectBalls?: DiamondCoord[];
  ghostBalls?: DiamondCoord[];
  className?: string;
};

export function DrillTable({
  name,
  cueBall,
  objectBalls = [],
  ghostBalls = [],
  className,
}: Props) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-felt)]">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          xmlns="http://www.w3.org/2000/svg"
          className="block h-auto w-full"
          role="img"
          aria-label={`Setup diagram for ${name}`}
        >
          <defs>
            <radialGradient id="drill-felt" cx="50%" cy="40%" r="80%">
              <stop offset="0%" stopColor="#1f6e3d" />
              <stop offset="100%" stopColor="#0a2a20" />
            </radialGradient>
            <linearGradient id="drill-rail" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a2410" />
              <stop offset="100%" stopColor="#1a0f06" />
            </linearGradient>
            <radialGradient id="drill-cb" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#cfc7b0" />
            </radialGradient>
            <radialGradient id="drill-ob" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fff8d8" />
              <stop offset="60%" stopColor="#e0a82e" />
              <stop offset="100%" stopColor="#7a5610" />
            </radialGradient>
          </defs>

          {/* Rail frame */}
          <rect
            x={0}
            y={0}
            width={SVG_W}
            height={SVG_H}
            rx={RAIL * 0.5}
            fill="url(#drill-rail)"
          />
          <rect
            x={RAIL - 4}
            y={RAIL - 4}
            width={SURFACE_W + 8}
            height={SURFACE_H + 8}
            rx={6}
            fill="none"
            stroke="rgba(201,162,74,0.55)"
            strokeWidth={1.5}
          />

          {/* Felt */}
          <rect
            x={RAIL}
            y={RAIL}
            width={SURFACE_W}
            height={SURFACE_H}
            fill="url(#drill-felt)"
          />

          {/* Head string */}
          <line
            x1={RAIL + 2 * UNIT}
            y1={RAIL}
            x2={RAIL + 2 * UNIT}
            y2={RAIL + SURFACE_H}
            stroke="rgba(236,225,196,0.18)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          {/* Foot spot */}
          <circle
            cx={RAIL + 6 * UNIT}
            cy={RAIL + 2 * UNIT}
            r={2.5}
            fill="rgba(236,225,196,0.35)"
          />

          {/* Diamond markers */}
          {Array.from({ length: 7 }).map((_, i) => {
            const x = RAIL + (i + 1) * UNIT;
            return (
              <g key={`dx-${i}`}>
                <circle cx={x} cy={RAIL / 2} r={2} fill="#c9a24a" />
                <circle cx={x} cy={SVG_H - RAIL / 2} r={2} fill="#c9a24a" />
              </g>
            );
          })}
          {Array.from({ length: 3 }).map((_, i) => {
            const y = RAIL + (i + 1) * UNIT;
            return (
              <g key={`dy-${i}`}>
                <circle cx={RAIL / 2} cy={y} r={2} fill="#c9a24a" />
                <circle cx={SVG_W - RAIL / 2} cy={y} r={2} fill="#c9a24a" />
              </g>
            );
          })}

          {/* Pockets */}
          {(["TR", "BR", "TL", "BL", "MR", "ML"] as const).map((id) => {
            const p = toSvg(POCKETS[id]);
            return (
              <g key={id}>
                <circle cx={p.x} cy={p.y} r={POCKET_R} fill="#050505" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={POCKET_R}
                  fill="none"
                  stroke="rgba(201,162,74,0.45)"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}

          {/* Ghost progression balls — faded outline only */}
          {ghostBalls.map((g, i) => {
            const p = toSvg(g);
            return (
              <circle
                key={`ghost-${i}`}
                cx={p.x}
                cy={p.y}
                r={BALL_R}
                fill="none"
                stroke="rgba(224,168,46,0.45)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Object balls */}
          {objectBalls.map((o, i) => {
            const p = toSvg(o);
            return (
              <g key={`ob-${i}`}>
                <circle cx={p.x} cy={p.y} r={BALL_R} fill="url(#drill-ob)" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={BALL_R}
                  fill="none"
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={0.8}
                />
              </g>
            );
          })}

          {/* Cue ball */}
          {cueBall && (
            <g>
              {(() => {
                const p = toSvg(cueBall);
                return (
                  <>
                    <circle cx={p.x} cy={p.y} r={BALL_R} fill="url(#drill-cb)" />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={BALL_R}
                      fill="none"
                      stroke="rgba(0,0,0,0.45)"
                      strokeWidth={0.8}
                    />
                  </>
                );
              })()}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
