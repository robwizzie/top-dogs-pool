import type { KinisterShot } from "@/lib/kinister/shots";
import { POCKETS } from "@/lib/kinister/shots";
import { applyHomography, type Homography } from "@/lib/kinister/homography";
import { videoToDisplay, type ContainMap, type Pt } from "@/lib/cv/table";
import type { ShotReport } from "@/lib/cv/shotAnalysis";
import type { Sample, TrackerSnapshot } from "@/lib/cv/shotTracker";

/** Table space (diamonds) → CSS pixels of the overlay. */
export type Projector = (p: Pt) => Pt;

export function makeProjector(Htv: Homography, map: ContainMap): Projector {
  return (p) => videoToDisplay(map, applyHomography(Htv, p));
}

/** Screen radius of a table-space circle at `p` (perspective-aware). */
export function screenRadius(project: Projector, p: Pt, r: number): number {
  const a = project(p);
  const bx = project({ x: p.x + r, y: p.y });
  const by = project({ x: p.x, y: p.y + r });
  return Math.max(3, (Math.hypot(bx.x - a.x, bx.y - a.y) + Math.hypot(by.x - a.x, by.y - a.y)) / 2);
}

/**
 * Where the cue ball must be at contact to send the object ball at
 * `target`, for a real ball of radius `r` (diamonds).
 */
export function realGhostBall(ob: Pt, target: Pt, r: number): Pt {
  const dx = ob.x - target.x;
  const dy = ob.y - target.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: ob.x + (dx / d) * 2 * r, y: ob.y + (dy / d) * 2 * r };
}

export function intendedPaths(shot: KinisterShot, r: number) {
  const target = shot.targetPocket ? POCKETS[shot.targetPocket] : null;
  const aimAt = shot.objectBallPath?.[0] ?? target;
  const ghost = aimAt ? realGhostBall(shot.objectBall, aimAt, r) : shot.objectBall;
  const cuePath = [shot.cueBall, ghost, ...shot.cueBallPath];
  const obPath = shot.objectBallPath
    ? [shot.objectBall, ...shot.objectBallPath]
    : target
      ? [shot.objectBall, target]
      : [];
  return { ghost, cuePath, obPath, target };
}

const COLORS = {
  cue: "rgba(255,255,255,0.95)",
  object: "rgba(240,196,84,0.95)",
  good: "rgba(110,219,135,0.95)",
  warn: "rgba(240,180,60,0.95)",
  bad: "rgba(232,82,72,0.95)",
  guide: "rgba(255,255,255,0.55)",
};

function circle(ctx: CanvasRenderingContext2D, c: Pt, r: number) {
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
}

function label(ctx: CanvasRenderingContext2D, text: string, at: Pt, color: string) {
  ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.beginPath();
  ctx.roundRect(at.x - w / 2, at.y - 10, w, 20, 10);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, at.x, at.y + 0.5);
}

function trail(ctx: CanvasRenderingContext2D, project: Projector, samples: Sample[] | Pt[], color: string, width = 3) {
  const pts = (samples as (Sample | Pt)[])
    .filter((s) => !("seen" in s) || s.seen)
    .map((s) => project(s));
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);
  poly(ctx, pts);
  ctx.stroke();
}

/**
 * Live tracker overlay, redrawn every processed frame: where the balls
 * are, where they need to go, and the trails of a shot in progress.
 */
export function drawLive(
  ctx: CanvasRenderingContext2D,
  project: Projector,
  snap: TrackerSnapshot,
  shot: KinisterShot,
  r: number,
  report: ShotReport | null,
) {
  if (snap.phase === "setup") {
    const s = snap.setup;
    const spots: [Pt, Pt | null, boolean, string, string][] = [
      [shot.cueBall, s.cue, s.cueOnSpot, "Cue ball", COLORS.cue],
      [shot.objectBall, s.object, s.objectOnSpot, "Object ball", COLORS.object],
    ];
    for (const [spot, at, ok, name, color] of spots) {
      const sp = project(spot);
      const rad = screenRadius(project, spot, r);
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ok ? COLORS.good : color;
      circle(ctx, sp, rad + 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (at) {
        const ap = project(at);
        ctx.lineWidth = 3;
        ctx.strokeStyle = ok ? COLORS.good : COLORS.warn;
        circle(ctx, ap, screenRadius(project, at, r) + 4);
        ctx.stroke();
        if (!ok) {
          // Arrow from where the ball is to its spot.
          ctx.strokeStyle = COLORS.warn;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          poly(ctx, [ap, sp]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      label(ctx, `${name} ${ok ? "✓" : at ? "→ spot" : "?"}`, { x: sp.x, y: sp.y - rad - 18 }, ok ? COLORS.good : color);
    }
    return;
  }

  if (snap.phase === "armed" || snap.phase === "in-shot") {
    const { cue, object } = snap;
    if (snap.phase === "in-shot") {
      trail(ctx, project, object.samples, COLORS.object);
      trail(ctx, project, cue.samples, COLORS.cue);
    }
    for (const [b, color] of [[cue, COLORS.cue], [object, COLORS.object]] as const) {
      if (b.status === "pocketed") continue;
      const p = project(b.pos);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = b.status === "occluded" || b.status === "lost" ? "rgba(255,255,255,0.35)" : color;
      circle(ctx, p, screenRadius(project, b.pos, r) + 4);
      ctx.stroke();
    }
    return;
  }

  if (snap.phase === "done" && report) {
    drawReport(ctx, project, shot, r, report);
  }
}

export function drawReport(
  ctx: CanvasRenderingContext2D,
  project: Projector,
  shot: KinisterShot,
  r: number,
  report: ShotReport,
) {
  const intended = intendedPaths(shot, r);
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  poly(ctx, intended.cuePath.slice(1).map(project));
  ctx.stroke();
  ctx.strokeStyle = "rgba(240,196,84,0.4)";
  poly(ctx, intended.obPath.map(project));
  ctx.stroke();
  ctx.setLineDash([]);

  trail(ctx, project, report.objectPath, COLORS.object, 3.5);
  trail(ctx, project, report.cuePath, COLORS.cue, 3.5);

  if (report.position) {
    const t = project(report.position.target);
    const a = project(report.position.actual);
    const good = report.position.error < 0.3;
    ctx.lineWidth = 2;
    ctx.strokeStyle = good ? COLORS.good : COLORS.warn;
    ctx.setLineDash([3, 4]);
    circle(ctx, t, screenRadius(project, report.position.target, 0.3));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    circle(ctx, a, screenRadius(project, report.position.actual, r) + 3);
    ctx.stroke();
  }
  if (report.targetPocket) {
    const pk = POCKETS[report.targetPocket];
    const p = project(pk);
    ctx.lineWidth = 3;
    ctx.strokeStyle = report.verdict === "make" ? COLORS.good : COLORS.bad;
    circle(ctx, p, screenRadius(project, pk, 0.28));
    ctx.stroke();
  }
}

/** Static guides: ghost ball, aim line, intended paths, target pocket. */
export function drawGuides(ctx: CanvasRenderingContext2D, project: Projector, shot: KinisterShot, r: number) {
  const { ghost, cuePath, obPath, target } = intendedPaths(shot, r);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.guide;
  poly(ctx, [project(shot.cueBall), project(ghost)]);
  ctx.stroke();
  if (cuePath.length > 2) {
    ctx.strokeStyle = "rgba(236,225,196,0.6)";
    poly(ctx, cuePath.slice(1).map(project));
    ctx.stroke();
  }
  if (obPath.length > 1) {
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = "rgba(240,196,84,0.6)";
    poly(ctx, obPath.map(project));
    ctx.stroke();
  }
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  circle(ctx, project(ghost), screenRadius(project, ghost, r));
  ctx.stroke();
  ctx.setLineDash([]);
  if (target) {
    ctx.strokeStyle = "rgba(232,82,72,0.85)";
    ctx.setLineDash([6, 4]);
    circle(ctx, project(target), screenRadius(project, target, 0.3));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const end = shot.cueBallPath[shot.cueBallPath.length - 1];
  if (end) {
    ctx.strokeStyle = "rgba(110,219,135,0.7)";
    ctx.setLineDash([2, 4]);
    circle(ctx, project(end), screenRadius(project, end, 0.3));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Diamond grid over the table so the player can check calibration. */
export function drawGrid(ctx: CanvasRenderingContext2D, project: Projector) {
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  for (let x = 0; x <= 8; x++) {
    ctx.strokeStyle = x === 0 || x === 8 ? "rgba(224,190,107,0.95)" : "rgba(224,190,107,0.45)";
    poly(ctx, [project({ x, y: 0 }), project({ x, y: 4 })]);
    ctx.stroke();
  }
  for (let y = 0; y <= 4; y++) {
    ctx.strokeStyle = y === 0 || y === 4 ? "rgba(224,190,107,0.95)" : "rgba(224,190,107,0.45)";
    poly(ctx, [project({ x: 0, y }), project({ x: 8, y })]);
    ctx.stroke();
  }
  // Mark the head rail so a flipped calibration is obvious.
  label(ctx, "HEAD", project({ x: -0.25, y: 2 }), "rgba(224,190,107,1)");
  label(ctx, "FOOT", project({ x: 8.25, y: 2 }), "rgba(224,190,107,1)");
}
