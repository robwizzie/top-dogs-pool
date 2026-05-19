import { ImageResponse } from "next/og";
import { getShot, POCKETS } from "@/lib/kinister/shots";
import { contactPoint, toSvg } from "@/lib/kinister/geometry";
import type { KinisterShot } from "@/lib/kinister/shots";

export const runtime = "edge";
export const alt = "Top Dogs Pool — shot card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Diagram (SVG viewBox) constants from lib/kinister/geometry — duplicated
// here as numeric constants because Satori in next/og prefers plain JSX.
const SVG_W = 876;
const SVG_H = 476;
const RAIL = 38;
const SURFACE_W = 800;
const SURFACE_H = 400;
const BALL_R = 14;
const POCKET_R = 22;

export default async function ShotOgImage({
  params,
}: {
  params: { id: string };
}) {
  const shot = getShot(params.id);
  const title = shot?.name ?? "Top Dogs Pool";
  const subtitle = shot
    ? `Shot ${String(shot.number).padStart(2, "0")} · ${shot.difficulty} · ${shot.series}`
    : "Bert Kinister's shot catalog";
  const blurb = shot?.description ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #0a2a20 0%, #0f3a2b 60%, #1f6e3d 100%)",
          display: "flex",
          padding: 56,
          color: "#ece1c4",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left column: text content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            paddingRight: 32,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 18,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: "#c9a24a",
                fontWeight: 700,
              }}
            >
              {subtitle}
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.05,
                color: "#fff8d8",
                letterSpacing: -1,
              }}
            >
              {title}
            </div>
            {blurb && (
              <div
                style={{
                  marginTop: 18,
                  fontSize: 22,
                  lineHeight: 1.4,
                  color: "rgba(236,225,196,0.78)",
                  display: "-webkit-box",
                  WebkitLineClamp: 5,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {blurb}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              color: "rgba(236,225,196,0.85)",
              fontSize: 22,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                background: "#c9a24a",
              }}
            />
            <div style={{ fontWeight: 700 }}>Top Dogs Pool</div>
            <div
              style={{
                marginLeft: 16,
                color: "rgba(236,225,196,0.55)",
                letterSpacing: 4,
                textTransform: "uppercase",
                fontSize: 15,
              }}
            >
              The Kinister Workout
            </div>
          </div>
        </div>

        {/* Right column: the table diagram (only when we have a shot) */}
        {shot && (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 520,
            }}
          >
            <ShotDiagramSvg shot={shot} />
          </div>
        )}
      </div>
    ),
    {
      ...size,
    },
  );
}

/**
 * Inline SVG diagram of a shot's setup + paths, sized to fit the OG image
 * right column. Uses only flat colors (no gradients) because Satori's
 * SVG support in next/og is limited.
 */
function ShotDiagramSvg({ shot }: { shot: KinisterShot }) {
  const cb = toSvg(shot.cueBall);
  const ob = toSvg(shot.objectBall);
  const contact = contactPoint(shot.cueBall, shot.objectBall);

  const cuePoints = [contact, ...shot.cueBallPath].map(toSvg);
  const approach = [toSvg(shot.cueBall), toSvg(contact)];

  const obFinalPath = shot.targetPocket
    ? [POCKETS[shot.targetPocket]]
    : shot.objectBallPath ?? [];
  const obPoints =
    obFinalPath.length > 0 ? [ob, ...obFinalPath.map(toSvg)] : null;

  return (
    <svg
      width={520}
      height={Math.round((520 * SVG_H) / SVG_W)}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Rail */}
      <rect
        x={0}
        y={0}
        width={SVG_W}
        height={SVG_H}
        rx={RAIL * 0.5}
        fill="#2a1808"
      />
      {/* Brass trim */}
      <rect
        x={RAIL - 3}
        y={RAIL - 3}
        width={SURFACE_W + 6}
        height={SURFACE_H + 6}
        rx={4}
        fill="none"
        stroke="rgba(201,162,74,0.55)"
        strokeWidth={2}
      />
      {/* Felt */}
      <rect
        x={RAIL}
        y={RAIL}
        width={SURFACE_W}
        height={SURFACE_H}
        fill="#0f3a2b"
      />
      {/* Pockets */}
      {(["TR", "BR", "TL", "BL", "MR", "ML"] as const).map((id) => {
        const p = toSvg(POCKETS[id]);
        return (
          <circle
            key={id}
            cx={p.x}
            cy={p.y}
            r={POCKET_R * 0.85}
            fill="#050505"
          />
        );
      })}
      {/* Approach line */}
      <PolyLine
        points={approach}
        stroke="rgba(236,225,196,0.5)"
        width={3}
        dash="3 6"
      />
      {/* CB carom path */}
      <PolyLine
        points={cuePoints}
        stroke="rgba(236,225,196,0.92)"
        width={3.5}
        dash="3 6"
      />
      {/* OB path */}
      {obPoints && (
        <PolyLine
          points={obPoints}
          stroke="rgba(224,190,107,0.92)"
          width={3.5}
          dash="7 7"
        />
      )}
      {/* Object ball */}
      <circle cx={ob.x} cy={ob.y} r={BALL_R} fill="#e0a82e" />
      <circle
        cx={ob.x}
        cy={ob.y}
        r={BALL_R}
        fill="none"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={1}
      />
      {/* Cue ball */}
      <circle cx={cb.x} cy={cb.y} r={BALL_R} fill="#ece1c4" />
      <circle
        cx={cb.x}
        cy={cb.y}
        r={BALL_R}
        fill="none"
        stroke="rgba(0,0,0,0.5)"
        strokeWidth={1}
      />
      {/* Target pocket pulse */}
      {shot.targetPocket && (
        <circle
          cx={toSvg(POCKETS[shot.targetPocket]).x}
          cy={toSvg(POCKETS[shot.targetPocket]).y}
          r={POCKET_R + 6}
          fill="none"
          stroke="rgba(232,82,72,0.8)"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      )}
    </svg>
  );
}

function PolyLine({
  points,
  stroke,
  width,
  dash,
}: {
  points: { x: number; y: number }[];
  stroke: string;
  width: number;
  dash?: string;
}) {
  if (points.length < 2) return null;
  const d = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
    )
    .join(" ");
  return (
    <path
      d={d}
      stroke={stroke}
      strokeWidth={width}
      strokeDasharray={dash}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
