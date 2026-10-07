import { ImageResponse } from "next/og";
import { publicImage, rackFonts } from "@/lib/og";
import { RACK_NAME, RACK_TAGLINE } from "@/lib/rack/config";
import { OG_IMAGE_SIZE, SITE_URL } from "@/lib/site";

/**
 * Link-preview card for Rack Up. It's styled as its own app (see
 * app/rack/layout.tsx), so it gets its own card in its own palette — the dark
 * theme's slate, felt and the red/gold wordmark — instead of the team card.
 *
 * Static: rendered once at build and served from the CDN.
 */

export const alt = `${RACK_NAME} — live APA match scoring, brackets and a TV scoreboard`;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

const BG = "#131a20";
const FG = "#f7f4ee";
const MUTED = "#a9b4bf";
const RED = "#ef4444";
const GOLD = "#ebaa2f";
const BORDER = "#34404c";

const FEATURES = ["Live APA scoring", "Brackets", "TV scoreboard", "Practice stats"];

export default async function RackOpengraphImage() {
  const [fonts, logo] = await Promise.all([rackFonts(), publicImage("rack/logo-512.png")]);
  const host = new URL(SITE_URL).host;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          backgroundColor: BG,
          backgroundImage:
            "radial-gradient(ellipse 70% 90% at 22% 50%, rgba(46,120,86,0.55) 0%, rgba(46,120,86,0.12) 45%, rgba(19,26,32,0) 75%)",
          fontFamily: "Poppins",
          color: FG,
          padding: "0 72px 0 60px",
        }}
      >
        <div
          style={{
            width: 440,
            height: 440,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <img src={logo} width={420} height={387} alt="" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginLeft: 48, flex: 1 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Lilita One",
              fontSize: 168,
              lineHeight: 1,
              letterSpacing: 1,
              textShadow: "0 6px 0 rgba(0,0,0,0.35)",
            }}
          >
            <span style={{ color: RED }}>Rack</span>
            <span style={{ color: GOLD, marginLeft: 28 }}>Up</span>
          </div>

          <div style={{ display: "flex", fontSize: 30, lineHeight: 1.3, color: FG, marginTop: 18, maxWidth: 440 }}>
            {RACK_TAGLINE}.
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 34 }}>
            {FEATURES.map((f) => (
              <div
                key={f}
                style={{
                  display: "flex",
                  fontSize: 21,
                  color: FG,
                  padding: "10px 20px",
                  marginRight: 12,
                  marginBottom: 12,
                  borderRadius: 9999,
                  border: `2px solid ${BORDER}`,
                  backgroundColor: "rgba(255,255,255,0.04)",
                }}
              >
                {f}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", fontSize: 22, color: MUTED, marginTop: 22 }}>{host}/rack</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
