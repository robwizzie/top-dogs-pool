import { ImageResponse } from "next/og";
import { TEAM_NAME } from "@/lib/config";
import { publicImage, siteFonts } from "@/lib/og";
import { OG_IMAGE_SIZE, SITE_OG_IMAGE, SITE_URL } from "@/lib/site";

/**
 * The site's link-preview card — what LinkedIn, iMessage, Slack, Discord and
 * X show for any page that doesn't have a card of its own.
 *
 * Built for the smallest place it appears: a LinkedIn "Featured" tile shows it
 * at roughly 300px wide, so there are only three things on it — the logo, the
 * name, and one line — and they are all big. Everything sits inside a 60px
 * margin so the 1.91:1 crops some apps apply don't clip it.
 *
 * Static: rendered once at build and served from the CDN.
 */

export const alt = SITE_OG_IMAGE.alt;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

const INK = "#070707";
const CREAM = "#fff6dc";
const CREAM_DIM = "#b9ad8d";
const BRASS = "#c9a24a";
const BRASS_BRIGHT = "#e0be6b";

export default async function OpengraphImage() {
  const [fonts, logo] = await Promise.all([siteFonts(), publicImage("logo.png")]);
  const host = new URL(SITE_URL).host;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: INK,
          // A lamp over the table: felt lit from above, falling off to the
          // dark of the hall at the edges.
          backgroundImage:
            "radial-gradient(ellipse 75% 95% at 24% 50%, #2e8b57 0%, #1b5e3f 28%, #0f3a2b 52%, #070707 88%)",
          fontFamily: "Poppins",
          color: CREAM,
        }}
      >
        {/* Brass rail */}
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 22,
            right: 22,
            bottom: 22,
            display: "flex",
            borderRadius: 30,
            border: `2px solid rgba(201,162,74,0.55)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 32,
            right: 32,
            bottom: 32,
            display: "flex",
            borderRadius: 22,
            border: `1px solid rgba(201,162,74,0.2)`,
          }}
        />

        {/* Logo, with a pool of light under it */}
        <div
          style={{
            width: 540,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 470,
              height: 470,
              borderRadius: 9999,
              backgroundImage:
                "radial-gradient(circle, rgba(224,190,107,0.32) 0%, rgba(224,190,107,0.08) 45%, rgba(224,190,107,0) 70%)",
            }}
          />
          <img src={logo} width={430} height={430} alt="" style={{ position: "relative" }} />
        </div>

        {/* Words */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingRight: 72,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 21,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: BRASS_BRIGHT,
            }}
          >
            <div
              style={{ width: 40, height: 2, backgroundColor: BRASS, marginRight: 16, display: "flex" }}
            />
            APA 8-Ball · South Jersey
          </div>

          <div
            style={{
              display: "flex",
              fontFamily: "Bebas Neue",
              fontSize: 156,
              lineHeight: 0.9,
              whiteSpace: "nowrap",
              letterSpacing: 2,
              marginTop: 18,
              color: CREAM,
              textShadow: "0 6px 24px rgba(0,0,0,0.55)",
            }}
          >
            {TEAM_NAME.toUpperCase()}
          </div>

          <div
            style={{
              display: "flex",
              fontFamily: "Instrument Serif",
              fontStyle: "italic",
              fontSize: 50,
              lineHeight: 1.1,
              marginTop: 14,
              color: BRASS_BRIGHT,
            }}
          >
            Run the rack. Earn the patch.
          </div>

          <div style={{ display: "flex", alignItems: "center", marginTop: 40 }}>
            {[1, 3, 6, 9, 8].map((n) => (
              <Ball key={n} n={n} />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 30,
              fontSize: 19,
              letterSpacing: 1,
              color: CREAM_DIM,
            }}
          >
            Roster · Schedule · Patch Watch · Training · Live
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 10,
              fontSize: 22,
              letterSpacing: 1,
              color: CREAM,
            }}
          >
            {host}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

const BALL: Record<number, [string, string]> = {
  1: ["#f4c430", "#8a6a0c"],
  3: ["#d8433b", "#6e1612"],
  6: ["#2a8a50", "#0b3a1f"],
  8: ["#3a3a3a", "#000000"],
  9: ["#f4c430", "#8a6a0c"],
};

/** A pool ball out of divs — Satori draws gradients and circles well. */
function Ball({ n }: { n: number }) {
  const [hi, lo] = BALL[n];
  const stripe = n > 8;
  const d = 58;
  return (
    <div
      style={{
        width: d,
        height: d,
        marginRight: 14,
        borderRadius: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        backgroundColor: stripe ? "#f7efd7" : hi,
        boxShadow: "0 8px 18px rgba(0,0,0,0.55)",
      }}
    >
      {stripe && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: d * 0.24,
            height: d * 0.52,
            backgroundColor: hi,
            display: "flex",
          }}
        />
      )}
      {/* Shading over the whole ball: a highlight up-left, shadow down-right. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: d,
          height: d,
          borderRadius: 9999,
          display: "flex",
          backgroundImage: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.12) 22%, rgba(0,0,0,0) 45%, ${lo}aa 100%)`,
        }}
      />
      <div
        style={{
          width: d * 0.48,
          height: d * 0.48,
          borderRadius: 9999,
          backgroundColor: "#fbf6e6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 17,
          color: "#141414",
          position: "relative",
        }}
      >
        {n}
      </div>
    </div>
  );
}
