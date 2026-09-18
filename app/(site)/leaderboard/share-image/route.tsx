/* eslint-disable @next/next/no-img-element -- Satori renders this route to a
   PNG on the server; next/image has no meaning inside an ImageResponse. */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getCurrentSession,
  getLeaderboard,
  getPatchInstances,
  getSessions,
} from "@/lib/apa";
import { rankWithTies } from "@/lib/apa/rank";
import {
  attachCurrentRanks,
  attachWeekPatches,
  getWeekRecap,
} from "@/lib/apa/week";
import {
  parseSessionScope,
  resolveScope,
  scopeLabel,
} from "@/lib/session-scope";

/**
 * The weekly share card.
 *
 * Rebuilt around one question: what would make someone actually post this in
 * the group chat on a Tuesday night? Not a season table — they've seen it. The
 * news is *this week*: the result, what the team put on the board, who earned a
 * patch, and who's on top now.
 *
 * Four things changed from the previous version, all for that reason:
 *
 *  · **A share-safe canvas, not a 1080×1924 strip.** The old card grew a row
 *    per player and ended up near 1:1.8, which chat apps crop to a letterbox or
 *    shrink until the names are unreadable. The height is now derived from the
 *    content but clamped to the 1:1 … 4:5 band every messaging app previews
 *    intact — so it neither ends in dead space nor runs off the bottom in week
 *    twelve.
 *  · **The week leads.** The old header read "Fall 2026 · 3.5 pts", which is as
 *    true in week 12 as in week 2. Now it opens with the match result.
 *  · **Patches are the hero.** They're the thing the app is named after and the
 *    thing anyone wants to show off, and the art needs real size to read at
 *    all — at 54px it was mud. They get a band of their own.
 *  · **Only people who scored.** The old card listed everyone on 0 pts, which
 *    filled a third of the image with zeroes.
 */

export const runtime = "nodejs";
export const revalidate = 3600;

const WIDTH = 1080;
/** Square, the tightest crop-safe shape. */
const HEIGHT_MIN = 1080;
/** 4:5 — the tallest portrait a feed or chat preview shows whole. */
const HEIGHT_MAX = 1350;

const PAD = 52;
const FOOTER_H = 92;
const ROW_H = 68;
const ROW_GAP = 8;
/**
 * Leeway in the fit model. Measured against a real render: the model runs a
 * couple of dozen pixels light across a full card, and being light is the
 * expensive direction — it clips a row — so it buys that back here.
 */
const SAFETY = 28;

/**
 * Satori's line box for a given font size.
 *
 * Not `fontSize * 1.2`: the box is ascent + descent + line gap of the actual
 * font, which for the default sans comes out around 1.35. Measured off a
 * rendered card rather than assumed.
 */
function line(fontSize: number): number {
  return Math.ceil(fontSize * 1.35);
}

const INK = "#070707";
const CREAM = "#ece1c4";
const CREAM_DIM = "#b9ad8d";
const BRASS = "#c9a24a";
const BRASS_BRIGHT = "#e0be6b";
const FELT_BRIGHT = "#2e8b57";
const POP_BRIGHT = "#e85248";

const PODIUM_TONE: Record<1 | 2 | 3, string> = {
  1: BRASS_BRIGHT,
  2: "#d6d6e0",
  3: "#d9974f",
};

const PATCH_FILES: Record<
  string,
  { rel: string; mime: string; label: string }
> = {
  sweep: { rel: "patches/sweep.png", mime: "image/png", label: "Sweep" },
  "mini-sweep": {
    rel: "patches/mini-sweep.png",
    mime: "image/png",
    label: "Mini-sweep",
  },
  "break-and-run": {
    rel: "patches/break-and-run.png",
    mime: "image/png",
    label: "Break & run",
  },
  "8-on-break": {
    rel: "patches/8-on-break.png",
    mime: "image/png",
    label: "8 on the break",
  },
  "level-up": {
    rel: "patches/level-up.png",
    mime: "image/png",
    label: "Level up",
  },
  "first-win": {
    rel: "patches/first-win.png",
    mime: "image/png",
    label: "First win",
  },
  mvp: { rel: "patches/mvp.svg", mime: "image/svg+xml", label: "MVP" },
};

const POOL_BALL_COLORS = [
  "#c9a24a",
  "#f4c453",
  "#1e5fad",
  "#c8362f",
  "#6b3aa0",
  "#d97a2b",
  "#1f6e3d",
  "#7a2418",
];

async function readPublicAsDataUrl(
  relPath: string,
  mime: string,
): Promise<string | null> {
  try {
    const buf = await readFile(join(process.cwd(), "public", relPath));
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function fmtPoints(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = url.searchParams.get("session") ?? undefined;

  const [sessions, currentSession] = await Promise.all([
    getSessions(),
    getCurrentSession(),
  ]);
  const allIds = sessions.map((s) => s.id);
  const scope = parseSessionScope(session, allIds);
  const selectedIds = resolveScope(scope, allIds, currentSession?.id);
  const label = scopeLabel(selectedIds, sessions);
  const leaderScope = scope.kind === "all" ? "all" : selectedIds;

  // "This week" only means something for a single session; across a
  // multi-select or All Time there is no shared match night to recap.
  const recapSessionId =
    scope.kind !== "all" && selectedIds.size === 1
      ? [...selectedIds][0]
      : undefined;

  const [allRows, patchInstances, recap] = await Promise.all([
    getLeaderboard(leaderScope),
    getPatchInstances(leaderScope),
    recapSessionId === undefined
      ? Promise.resolve(null)
      : getWeekRecap(recapSessionId),
  ]);

  if (recap) {
    attachWeekPatches(
      recap,
      patchInstances,
      (pid) => allRows.find((r) => r.playerId === pid)?.playerName ?? pid,
    );
    attachCurrentRanks(recap, allRows);
  }
  const weekPatches = recap?.patches ?? [];

  const ranked = rankWithTies(allRows, (r) => r.points);
  const podium = ranked.slice(0, 3);
  const scorers = ranked.slice(3).filter(({ row }) => row.points > 0);

  /* ---- assets ------------------------------------------------------- */
  const patchAssets: Record<string, string | null> = Object.fromEntries(
    await Promise.all(
      Object.entries(PATCH_FILES).map(async ([k, v]) => [
        k,
        await readPublicAsDataUrl(v.rel, v.mime),
      ]),
    ),
  );

  const profileImages = new Map<string, string>();
  for (const { row } of ranked) {
    if (!row.profileImage) continue;
    const data = await readPublicAsDataUrl(
      row.profileImage.replace(/^\//, ""),
      row.profileImage.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg",
    );
    if (data) profileImages.set(row.playerId, data);
  }

  const totalPoints = allRows.reduce((s, r) => s + r.points, 0);
  const totalPatches = allRows.reduce(
    (s, r) =>
      s +
      r.sweeps +
      r.miniSweeps +
      r.breakAndRuns +
      r.eightOnBreaks +
      r.levelUps +
      r.firstWin +
      r.mvp,
    0,
  );

  /**
   * Three numbers, and which three depends on whether there's a week to
   * report. Without one, "patches won: 0" would be a lie of framing (it means
   * "none this week", but there is no this week) and the season total would
   * simply repeat the first card.
   */
  const stats = recap
    ? [
        {
          v: fmtPoints(recap.teamPoints),
          l: "points this week",
          c: BRASS_BRIGHT,
        },
        { v: String(weekPatches.length), l: "patches this week", c: CREAM },
        { v: fmtPoints(totalPoints), l: "season total", c: CREAM },
      ]
    : [
        { v: fmtPoints(totalPoints), l: "patch points", c: BRASS_BRIGHT },
        { v: String(totalPatches), l: "patches earned", c: CREAM },
        {
          v: String(allRows.filter((r) => r.points > 0).length),
          l: "on the board",
          c: CREAM,
        },
      ];
  const won =
    recap?.teamScore != null &&
    recap?.opponentScore != null &&
    recap.teamScore > recap.opponentScore;
  const lost =
    recap?.teamScore != null &&
    recap?.opponentScore != null &&
    recap.teamScore < recap.opponentScore;

  /* ---- fitting ------------------------------------------------------
   * Satori can't measure, so the canvas is sized from a deliberately
   * generous model of the blocks above. Over-estimating costs a little
   * slack above the footer; under-estimating would push the footer off the
   * bottom, so the list block also carries `flex: 1` + `overflow: hidden`
   * as a backstop.
   */
  const heroPatches = weekPatches.slice(0, 4);
  const patchArt =
    heroPatches.length >= 4 ? 132 : heroPatches.length === 3 ? 148 : 160;
  const patchBandH =
    heroPatches.length > 0
      ? line(21) + 12 + patchArt + 8 + line(27) + 2 + line(20)
      : 0;

  // Tallest podium card, summed from the sizes it is actually built with:
  // padding, badge, avatar, name, the points figure, and the W-L line.
  const podiumH =
    22 + line(20) + 10 + 104 + 10 + line(31) + 2 + line(74) + line(20) + 24;

  const headerH =
    34 + line(22) + 12 + line(78) + (recap ? 14 + 16 + line(30) : 0);
  const statsH = 26 + 16 + line(54) + 2 + line(21) + 16;

  const fixedH =
    8 + // brass rule
    headerH +
    statsH +
    (patchBandH ? 24 + patchBandH : 0) +
    24 +
    podiumH +
    FOOTER_H +
    SAFETY;

  const listRoom = Math.max(0, HEIGHT_MAX - fixedH - 20);
  const listRows = Math.max(
    0,
    Math.min(scorers.length, Math.floor(listRoom / (ROW_H + ROW_GAP))),
  );
  const listed = scorers.slice(0, listRows);
  const hiddenScorers = scorers.length - listed.length;

  const listH =
    listed.length > 0 || hiddenScorers > 0
      ? 20 +
        listed.length * (ROW_H + ROW_GAP) +
        (hiddenScorers > 0 ? 36 : 0)
      : 0;

  const HEIGHT = Math.max(
    HEIGHT_MIN,
    Math.min(HEIGHT_MAX, Math.round(fixedH + listH)),
  );

  const avatar = (playerId: string, seed: number, size: number) => {
    const src = profileImages.get(playerId);
    if (src) {
      return (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            borderRadius: size,
            objectFit: "cover",
            objectPosition: "top",
          }}
        />
      );
    }
    // No photo: a pool ball, drawn the way one looks — coloured body, white
    // number patch. A flat disc with a digit on it reads as a placeholder.
    const patch = Math.round(size * 0.58);
    return (
      <div
        style={{
          display: "flex",
          width: size,
          height: size,
          borderRadius: size,
          background: POOL_BALL_COLORS[seed % POOL_BALL_COLORS.length],
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            width: patch,
            height: patch,
            borderRadius: patch,
            background: "#f6f1e4",
            alignItems: "center",
            justifyContent: "center",
            color: "#101010",
            fontSize: Math.round(patch * 0.66),
            fontWeight: 700,
          }}
        >
          {seed}
        </div>
      </div>
    );
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(160deg, #0d2a20 0%, ${INK} 46%, #10130f 100%)`,
          color: CREAM,
          fontFamily: "sans-serif",
        }}
      >
        {/* brass hairline */}
        <div
          style={{
            display: "flex",
            height: 8,
            background: `linear-gradient(90deg, ${BRASS}, ${BRASS_BRIGHT}, ${BRASS})`,
          }}
        />

        {/* ---- header ------------------------------------------------ */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: `34px ${PAD}px 0 ${PAD}px`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                width: 12,
                height: 12,
                borderRadius: 12,
                background: BRASS,
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 22,
                letterSpacing: 7,
                color: BRASS,
                fontWeight: 700,
              }}
            >
              TOP DAWGS · PATCH WATCH
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 20,
              marginTop: 12,
            }}
          >
            <div style={{ display: "flex", fontSize: 78, fontWeight: 800 }}>
              {recap ? `Week ${recap.week}` : label}
            </div>
            {recap && (
              <div style={{ display: "flex", fontSize: 32, color: CREAM_DIM }}>
                {label}
              </div>
            )}
          </div>

          {/* the match result — the actual news */}
          {recap && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginTop: 14,
              }}
            >
              {recap.teamScore != null && recap.opponentScore != null && (
                <div
                  style={{
                    display: "flex",
                    padding: "8px 20px",
                    borderRadius: 999,
                    fontSize: 30,
                    fontWeight: 700,
                    color: won ? FELT_BRIGHT : lost ? POP_BRIGHT : BRASS_BRIGHT,
                    background: won
                      ? "rgba(46,139,87,0.16)"
                      : lost
                        ? "rgba(232,82,72,0.14)"
                        : "rgba(201,162,74,0.16)",
                  }}
                >
                  {won ? "Won" : lost ? "Lost" : "Tied"} {recap.teamScore}–
                  {recap.opponentScore}
                </div>
              )}
              <div style={{ display: "flex", fontSize: 30, color: CREAM_DIM }}>
                {recap.opponent ? `vs ${recap.opponent}` : ""}
                {fmtDate(recap.date) ? ` · ${fmtDate(recap.date)}` : ""}
              </div>
            </div>
          )}
        </div>

        {/* ---- the week's numbers ------------------------------------ */}
        <div
          style={{
            display: "flex",
            gap: 14,
            padding: `26px ${PAD}px 0 ${PAD}px`,
          }}
        >
          {stats.map((s) => (
            <div
              key={s.l}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "16px 22px",
                borderRadius: 18,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(201,162,74,0.18)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 54,
                  fontWeight: 800,
                  color: s.c,
                }}
              >
                {s.v}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 21,
                  color: CREAM_DIM,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                {s.l}
              </div>
            </div>
          ))}
        </div>

        {/* ---- patches earned this week ------------------------------
            The art is dense — at chip size it reads as a smudge, so it gets
            a band and enough pixels to actually be a trophy. */}
        {heroPatches.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: `24px ${PAD}px 0 ${PAD}px`,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 21,
                letterSpacing: 4,
                color: BRASS,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Patches earned this week
              {weekPatches.length > heroPatches.length
                ? ` · +${weekPatches.length - heroPatches.length} more`
                : ""}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 22,
                marginTop: 12,
              }}
            >
              {heroPatches.map((p, i) => (
                <div
                  key={`${p.playerId}-${p.kind}-${i}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  {patchAssets[p.kind] ? (
                    <img
                      src={patchAssets[p.kind] as string}
                      alt=""
                      width={patchArt}
                      height={patchArt}
                      style={{ width: patchArt, height: patchArt }}
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        width: patchArt,
                        height: patchArt,
                      }}
                    />
                  )}
                  <div
                    style={{
                      display: "flex",
                      fontSize: 27,
                      fontWeight: 700,
                      marginTop: 8,
                      textAlign: "center",
                    }}
                  >
                    {p.playerName}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 20,
                      color: BRASS_BRIGHT,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      marginTop: 2,
                    }}
                  >
                    {PATCH_FILES[p.kind]?.label ?? p.kind}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- the board --------------------------------------------- */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
            padding: `24px ${PAD}px 0 ${PAD}px`,
          }}
        >
          {/* podium — 2 · 1 · 3 */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
            {[1, 0, 2]
              .filter((i) => i < podium.length)
              .map((i) => {
                const { row, rank, tied } = podium[i];
                const first = i === 0;
                const tone = PODIUM_TONE[(Math.min(rank, 3) || 1) as 1 | 2 | 3];
                return (
                  <div
                    key={row.playerId}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flex: 1,
                      padding: first ? "22px 14px 24px" : "16px 14px 18px",
                      borderRadius: 22,
                      background: first
                        ? "rgba(201,162,74,0.10)"
                        : "rgba(255,255,255,0.035)",
                      border: `1px solid ${first ? "rgba(201,162,74,0.45)" : "rgba(255,255,255,0.10)"}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        fontSize: 20,
                        letterSpacing: 3,
                        fontWeight: 800,
                        color: tone,
                      }}
                    >
                      {tied ? `T${rank}` : `#${rank}`}
                    </div>
                    <div style={{ display: "flex", marginTop: 10 }}>
                      {avatar(row.playerId, i + 1, first ? 104 : 78)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        fontSize: first ? 31 : 27,
                        fontWeight: 700,
                        marginTop: 10,
                        textAlign: "center",
                      }}
                    >
                      {row.playerName}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        marginTop: 2,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          fontSize: first ? 74 : 56,
                          fontWeight: 800,
                          color: tone,
                        }}
                      >
                        {fmtPoints(row.points)}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          fontSize: 20,
                          color: CREAM_DIM,
                        }}
                      >
                        {row.points === 1 ? "PT" : "PTS"}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        fontSize: 20,
                        color: CREAM_DIM,
                      }}
                    >
                      {row.wins}/{row.matchesPlayed} W
                    </div>
                  </div>
                );
              })}
          </div>

          {/* everyone else who scored */}
          {(listed.length > 0 || hiddenScorers > 0) && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: ROW_GAP,
                marginTop: 20,
              }}
            >
              {listed.map(({ row, rank, tied }, i) => (
                <div
                  key={row.playerId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    height: ROW_H,
                    padding: "0 20px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.035)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: 48,
                      fontSize: 28,
                      fontWeight: 700,
                      color: CREAM_DIM,
                    }}
                  >
                    {tied ? `T${rank}` : rank}
                  </div>
                  {avatar(row.playerId, i + 4, 44)}
                  <div style={{ display: "flex", flex: 1, fontSize: 29 }}>
                    {row.playerName}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 22,
                      color: CREAM_DIM,
                      marginRight: 18,
                    }}
                  >
                    {row.wins}/{row.matchesPlayed} W
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 34,
                      fontWeight: 800,
                      color: BRASS_BRIGHT,
                    }}
                  >
                    {fmtPoints(row.points)}
                  </div>
                </div>
              ))}
              {hiddenScorers > 0 && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 22,
                    color: CREAM_DIM,
                    paddingLeft: 20,
                    marginTop: 4,
                  }}
                >
                  +{hiddenScorers} more on the board
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- footer ------------------------------------------------ */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${PAD}px`,
            height: FOOTER_H,
            borderTop: "1px solid rgba(201,162,74,0.18)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                width: 24,
                height: 24,
                borderRadius: 24,
                background: BRASS,
              }}
            />
            <div style={{ display: "flex", fontSize: 24, color: CREAM_DIM }}>
              poolmaxxing.com/leaderboard
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: CREAM_DIM }}>
            Full board, every session
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
