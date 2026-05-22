import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getCurrentSession,
  getLeaderboard,
  getPreviousWeekRanks,
  getSessions,
} from "@/lib/apa";
import {
  parseSessionScope,
  resolveScope,
  scopeLabel,
} from "@/lib/session-scope";

export const runtime = "nodejs";
export const revalidate = 3600;

const WIDTH = 1080;
const HEADER_H = 280;
const ROW_H = 134;
const FOOTER_H = 96;
const MAX_ROWS = 12;

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

const PATCH_FILES: Record<
  | "sweep"
  | "miniSweeps"
  | "breakAndRuns"
  | "eightOnBreaks"
  | "levelUps"
  | "firstWin"
  | "mvp",
  { rel: string; mime: string; label: string; tint: string }
> = {
  sweep: { rel: "patches/sweep.png", mime: "image/png", label: "Sweep", tint: "#e85248" },
  miniSweeps: { rel: "patches/mini-sweep.png", mime: "image/png", label: "Mini", tint: "#e0be6b" },
  breakAndRuns: { rel: "patches/break-and-run.png", mime: "image/png", label: "B&R", tint: "#2e8b57" },
  eightOnBreaks: { rel: "patches/8-on-break.png", mime: "image/png", label: "8oB", tint: "#ece1c4" },
  levelUps: { rel: "patches/level-up.png", mime: "image/png", label: "Level Up", tint: "#f4c453" },
  firstWin: { rel: "patches/first-win.png", mime: "image/png", label: "First Win", tint: "#1f6e3d" },
  mvp: { rel: "patches/mvp.svg", mime: "image/svg+xml", label: "MVP", tint: "#4ca0d8" },
};

const POOL_BALL_COLORS = [
  null,
  "#f4c453", // 1 yellow
  "#1e5fad", // 2 blue
  "#c8362f", // 3 red
  "#6b3aa0", // 4 purple
  "#d97a2b", // 5 orange
  "#1f6e3d", // 6 green
  "#7a2418", // 7 maroon
];

const PODIUM_STYLES: Record<
  1 | 2 | 3,
  { bg: string; ring: string; text: string }
> = {
  1: { bg: "#e0be6b", ring: "#fff8d8", text: "#3a2607" },
  2: { bg: "#c8c8d4", ring: "#f0f0f7", text: "#1e1e2a" },
  3: { bg: "#c2823f", ring: "#e8a96b", text: "#2a1408" },
};

function formatPoints(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

type DeltaTag = { text: string; color: string; bg: string };
function deltaTag(rank: number, prev: number | undefined, hasPrev: boolean): DeltaTag | null {
  if (!hasPrev) return null;
  if (prev === undefined) return { text: "NEW", color: "#ece1c4", bg: "rgba(76,160,216,0.28)" };
  if (prev === rank) return { text: "HOLD", color: "rgba(236,225,196,0.55)", bg: "rgba(255,255,255,0.06)" };
  if (prev > rank) return { text: `UP ${prev - rank}`, color: "#a8e6b8", bg: "rgba(46,139,87,0.30)" };
  return { text: `DOWN ${rank - prev}`, color: "#f1b3a8", bg: "rgba(200,54,47,0.30)" };
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

  const [allRows, prevRanksMap] = await Promise.all([
    getLeaderboard(scope.kind === "all" ? "all" : selectedIds),
    getPreviousWeekRanks(scope.kind === "all" ? "all" : selectedIds),
  ]);
  const rows = allRows.slice(0, MAX_ROWS);
  const hasPrev = prevRanksMap.size > 0;

  // Load all required image assets as data URLs (Satori needs them inline).
  const patchAssets = Object.fromEntries(
    await Promise.all(
      Object.entries(PATCH_FILES).map(async ([k, v]) => [
        k,
        await readPublicAsDataUrl(v.rel, v.mime),
      ]),
    ),
  ) as Record<keyof typeof PATCH_FILES, string | null>;

  const profileImages = new Map<string, string>();
  for (const r of rows) {
    if (!r.profileImage) continue;
    const data = await readPublicAsDataUrl(
      r.profileImage.replace(/^\//, ""),
      r.profileImage.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
    );
    if (data) profileImages.set(r.playerId, data);
  }

  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const totalSweeps = rows.reduce((s, r) => s + r.sweeps, 0);
  const totalMini = rows.reduce((s, r) => s + r.miniSweeps, 0);
  const totalLevelUps = rows.reduce((s, r) => s + r.levelUps, 0);
  const totalFirstWins = rows.reduce((s, r) => s + r.firstWin, 0);
  const totalMvp = rows.reduce((s, r) => s + r.mvp, 0);

  const HEIGHT = HEADER_H + Math.max(rows.length, 1) * ROW_H + FOOTER_H;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(165deg, #07221a 0%, #0b3326 45%, #163f31 100%)",
          color: "#ece1c4",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Brass top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background:
              "linear-gradient(90deg, transparent, #c9a24a 30%, #e0be6b 50%, #c9a24a 70%, transparent)",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "44px 56px 28px",
            borderBottom: "1px solid rgba(201,162,74,0.22)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 18,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "#c9a24a",
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                background: "#e0be6b",
                display: "flex",
              }}
            />
            <span style={{ display: "flex" }}>Top Dawgs · Patch Watch</span>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                background: "#e0be6b",
                display: "flex",
              }}
            />
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1,
              color: "#fff8d8",
              letterSpacing: -2,
              display: "flex",
            }}
          >
            {label}
          </div>
          <div
            style={{
              marginTop: 18,
              display: "flex",
              gap: 22,
              fontSize: 22,
              color: "rgba(236,225,196,0.75)",
              alignItems: "center",
            }}
          >
            <span style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#e0be6b", fontWeight: 700 }}>
                {formatPoints(totalPoints)}
              </span>
              pts
            </span>
            {totalSweeps > 0 && (
              <span style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#e85248", fontWeight: 700 }}>
                  {totalSweeps}
                </span>
                sweep{totalSweeps === 1 ? "" : "s"}
              </span>
            )}
            {totalMini > 0 && (
              <span style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#e0be6b", fontWeight: 700 }}>
                  {totalMini}
                </span>
                mini
              </span>
            )}
            {totalLevelUps > 0 && (
              <span style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#f4c453", fontWeight: 700 }}>
                  {totalLevelUps}
                </span>
                level-up{totalLevelUps === 1 ? "" : "s"}
              </span>
            )}
            {totalFirstWins > 0 && (
              <span style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#a8e6b8", fontWeight: 700 }}>
                  {totalFirstWins}
                </span>
                first win{totalFirstWins === 1 ? "" : "s"}
              </span>
            )}
            {totalMvp > 0 && (
              <span style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#4ca0d8", fontWeight: 700 }}>
                  {totalMvp}
                </span>
                MVP{totalMvp === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        {/* Rows */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: "8px 0",
          }}
        >
          {rows.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(236,225,196,0.6)",
                fontSize: 24,
                padding: 40,
              }}
            >
              No leaderboard data for this selection.
            </div>
          ) : (
            rows.map((row, i) => {
              const rank = i + 1;
              const isPodium = rank <= 3;
              const prevRank = prevRanksMap.get(row.playerId);
              const delta = deltaTag(rank, prevRank, hasPrev);
              const avatar = profileImages.get(row.playerId);
              const ballColor = POOL_BALL_COLORS[((rank - 1) % 7) + 1] ?? "#c9a24a";
              const earnedPatches: Array<{
                key: keyof typeof PATCH_FILES;
                count: number;
                tint: string;
              }> = [];
              if (row.sweeps)
                earnedPatches.push({ key: "sweep", count: row.sweeps, tint: PATCH_FILES.sweep.tint });
              if (row.miniSweeps)
                earnedPatches.push({ key: "miniSweeps", count: row.miniSweeps, tint: PATCH_FILES.miniSweeps.tint });
              if (row.breakAndRuns)
                earnedPatches.push({ key: "breakAndRuns", count: row.breakAndRuns, tint: PATCH_FILES.breakAndRuns.tint });
              if (row.eightOnBreaks)
                earnedPatches.push({ key: "eightOnBreaks", count: row.eightOnBreaks, tint: PATCH_FILES.eightOnBreaks.tint });
              if (row.levelUps)
                earnedPatches.push({ key: "levelUps", count: row.levelUps, tint: PATCH_FILES.levelUps.tint });
              if (row.firstWin)
                earnedPatches.push({ key: "firstWin", count: row.firstWin, tint: PATCH_FILES.firstWin.tint });
              if (row.mvp)
                earnedPatches.push({ key: "mvp", count: row.mvp, tint: PATCH_FILES.mvp.tint });

              return (
                <div
                  key={row.playerId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 22,
                    padding: "18px 56px",
                    borderBottom:
                      i < rows.length - 1
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "none",
                    background: isPodium
                      ? rank === 1
                        ? "linear-gradient(90deg, rgba(201,162,74,0.18), transparent 70%)"
                        : "linear-gradient(90deg, rgba(201,162,74,0.08), transparent 70%)"
                      : "transparent",
                  }}
                >
                  {/* Rank badge */}
                  {isPodium ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 72,
                        height: 72,
                        flexShrink: 0,
                        borderRadius: 36,
                        background: PODIUM_STYLES[rank as 1 | 2 | 3].bg,
                        border: `3px solid ${PODIUM_STYLES[rank as 1 | 2 | 3].ring}`,
                        color: PODIUM_STYLES[rank as 1 | 2 | 3].text,
                        fontSize: 42,
                        fontWeight: 900,
                        letterSpacing: -1,
                        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
                      }}
                    >
                      {rank}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 72,
                        height: 72,
                        flexShrink: 0,
                        color: "rgba(236,225,196,0.55)",
                        fontSize: 36,
                        fontWeight: 700,
                        letterSpacing: -1,
                      }}
                    >
                      {rank}
                    </div>
                  )}

                  {/* Avatar */}
                  {avatar ? (
                    <img
                      src={avatar}
                      width={84}
                      height={84}
                      alt=""
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: 42,
                        objectFit: "cover",
                        flexShrink: 0,
                        border: "2px solid rgba(201,162,74,0.55)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: 42,
                        flexShrink: 0,
                        background: ballColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid rgba(255,255,255,0.18)",
                        boxShadow: "inset 0 4px 12px rgba(255,255,255,0.18), inset 0 -8px 14px rgba(0,0,0,0.32)",
                      }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          background: "#fff8d8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 26,
                          fontWeight: 800,
                          color: "#1a1a1a",
                          letterSpacing: -1,
                        }}
                      >
                        {((rank - 1) % 7) + 1}
                      </div>
                    </div>
                  )}

                  {/* Name + meta */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      gap: 6,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 32,
                          fontWeight: 700,
                          color: "#fff8d8",
                          maxWidth: 480,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "flex",
                        }}
                      >
                        {row.playerName}
                      </span>
                      {row.skillLevel !== undefined && (
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 12,
                            background: "rgba(201,162,74,0.18)",
                            color: "#e0be6b",
                            letterSpacing: 1,
                            display: "flex",
                          }}
                        >
                          SL{row.skillLevel}
                        </span>
                      )}
                      {delta && (
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 12,
                            background: delta.bg,
                            color: delta.color,
                            letterSpacing: 0.5,
                            display: "flex",
                          }}
                        >
                          {delta.text}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {earnedPatches.length === 0 ? (
                        <span
                          style={{
                            fontSize: 16,
                            color: "rgba(236,225,196,0.45)",
                            fontStyle: "italic",
                            display: "flex",
                          }}
                        >
                          {row.matchesPlayed} match
                          {row.matchesPlayed === 1 ? "" : "es"} · waiting on a
                          patch
                        </span>
                      ) : (
                        earnedPatches.map(({ key, count, tint }) => {
                          const src = patchAssets[key];
                          if (!src) return null;
                          return (
                            <div
                              key={key}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 10px 4px 4px",
                                borderRadius: 16,
                                background: "rgba(255,255,255,0.04)",
                                border: `1px solid ${tint}55`,
                              }}
                            >
                              <img
                                src={src}
                                width={32}
                                height={32}
                                alt=""
                                style={{ width: 32, height: 32 }}
                              />
                              {count > 1 && (
                                <span
                                  style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: tint,
                                    display: "flex",
                                  }}
                                >
                                  ×{count}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Points */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      flexShrink: 0,
                      minWidth: 110,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 56,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: isPodium ? "#e0be6b" : "#c9a24a",
                        letterSpacing: -1,
                        display: "flex",
                      }}
                    >
                      {formatPoints(row.points)}
                    </span>
                    <span
                      style={{
                        marginTop: 4,
                        fontSize: 13,
                        letterSpacing: 3,
                        color: "rgba(236,225,196,0.5)",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        display: "flex",
                      }}
                    >
                      {row.points === 1 ? "pt" : "pts"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "26px 56px",
            borderTop: "1px solid rgba(201,162,74,0.22)",
            background: "rgba(0,0,0,0.22)",
            color: "rgba(236,225,196,0.75)",
            fontSize: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                background:
                  "linear-gradient(135deg, #e0be6b 0%, #c9a24a 60%, #8a6a26 100%)",
                display: "flex",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            />
            <span style={{ fontWeight: 700, color: "#fff8d8" }}>
              topdawgspool.com/leaderboard
            </span>
          </div>
          {hasPrev && (
            <div
              style={{
                display: "flex",
                gap: 16,
                fontSize: 14,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "rgba(236,225,196,0.55)",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    color: "#a8e6b8",
                    fontWeight: 800,
                    display: "flex",
                  }}
                >
                  UP
                </span>
                moved up
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    color: "#f1b3a8",
                    fontWeight: 800,
                    display: "flex",
                  }}
                >
                  DOWN
                </span>
                moved down
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ color: "#9dc5ec", fontWeight: 800, display: "flex" }}>
                  NEW
                </span>
                this week
              </span>
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}
