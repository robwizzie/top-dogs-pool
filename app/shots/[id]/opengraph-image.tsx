import { ImageResponse } from "next/og";
import { getShot } from "@/lib/kinister/shots";

export const runtime = "edge";
export const alt = "Top Dogs Pool — shot card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          color: "#ece1c4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "#c9a24a",
              fontWeight: 700,
            }}
          >
            {subtitle}
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#fff8d8",
              letterSpacing: -1,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          {blurb && (
            <div
              style={{
                marginTop: 24,
                fontSize: 28,
                lineHeight: 1.35,
                color: "rgba(236,225,196,0.75)",
                maxWidth: 1000,
                display: "-webkit-box",
                WebkitLineClamp: 3,
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
            justifyContent: "space-between",
            color: "rgba(236,225,196,0.85)",
            fontSize: 26,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: "#c9a24a",
              }}
            />
            <div style={{ fontWeight: 700 }}>Top Dogs Pool</div>
          </div>
          <div
            style={{
              color: "rgba(236,225,196,0.55)",
              letterSpacing: 4,
              textTransform: "uppercase",
              fontSize: 18,
            }}
          >
            The Kinister Workout
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
