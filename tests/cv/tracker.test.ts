/**
 * End-to-end check of the AR shot tracker on synthetic camera frames
 * (see sim.ts), from setup through practice strokes to the shot report.
 *
 * Run: npx tsx tests/cv/tracker.test.ts
 */
import { getShot, POCKETS, type KinisterShot } from "@/lib/kinister/shots";
import { TableVision, tableCrop } from "@/lib/cv/vision";
import { ShotTracker, type TrackerSnapshot } from "@/lib/cv/shotTracker";
import { analyzeShot } from "@/lib/cv/shotAnalysis";
import { detectCornerPockets } from "@/lib/cv/detect";
import { TABLE_SIZES, type Pt } from "@/lib/cv/table";
import { FW, FH, R, Htf, screen, render, cropOf, stepBall, type Ball, type Scene } from "./sim";

let fail = 0;
const check = (n: string, c: boolean, e?: unknown) => {
  if (!c) {
    fail++;
    console.log("FAIL:", n, JSON.stringify(e ?? ""));
  } else console.log("ok:", n);
};

function runShot(
  shot: KinisterShot,
  opts: { aimErrDeg: number; speed: number; follow: number; label: string; cueOffset?: Pt },
) {
  const crop = tableCrop(Htf, FW, FH);
  const vision = new TableVision(Htf, crop, R);
  const tracker = new ShotTracker({ ballR: R, expectedCue: shot.cueBall, expectedObject: shot.objectBall });
  let t = 1000;
  const dtMs = 1000 / 30;
  let snap: TrackerSnapshot = tracker.snapshot();
  const feed = (s: Scene) => {
    const t0 = performance.now();
    const fr = render(s);
    const t1 = performance.now();
    vision.ingest(cropOf(fr, crop));
    const t2 = performance.now();
    snap = tracker.step(vision, t);
    const t3 = performance.now();
    if (process.env.PROF)
      console.log(
        "render", (t1 - t0).toFixed(1), "vision", (t2 - t1).toFixed(1), "track", (t3 - t2).toFixed(1), snap.phase,
        vision.blobs.map((b) => `${b.center.x.toFixed(2)},${b.center.y.toFixed(2)} a${(b.area / vision.ballArea).toFixed(2)} f${b.fill.toFixed(2)}`).join(" "),
        snap.phase === "setup" ? JSON.stringify(snap.setup) : "",
      );
    t += dtMs;
    return snap;
  };

  const cue0 = { x: shot.cueBall.x + (opts.cueOffset?.x ?? 0), y: shot.cueBall.y + (opts.cueOffset?.y ?? 0) };
  const ob0 = shot.objectBall;
  const others = [{ x: 6.5, y: 3.2 }];

  // Setup: player's hand placing the cue ball, then stepping back.
  for (let i = 0; i < 10; i++) feed({ cue: null, obj: ob0, others, shadow: { c: cue0, rx: 0.8, ry: 0.5 } });
  let armedAt = -1;
  for (let i = 0; i < 40; i++) {
    feed({ cue: cue0, obj: ob0, others, gain: 1 - i * 0.002 });
    if (snap.phase === "armed" && armedAt < 0) armedAt = i;
  }
  check(`${opts.label}: auto-arms once balls are on their spots`, armedAt >= 0, snap.phase);

  // Aim: ghost ball direction, rotated by the error.
  const pk = shot.targetPocket ? POCKETS[shot.targetPocket] : ob0;
  const toPk = Math.hypot(pk.x - ob0.x, pk.y - ob0.y);
  const ghost = { x: ob0.x - ((pk.x - ob0.x) / toPk) * 2 * R, y: ob0.y - ((pk.y - ob0.y) / toPk) * 2 * R };
  let d = { x: ghost.x - cue0.x, y: ghost.y - cue0.y };
  const m = Math.hypot(d.x, d.y);
  d = { x: d.x / m, y: d.y / m };
  const a = (opts.aimErrDeg * Math.PI) / 180;
  d = { x: d.x * Math.cos(a) - d.y * Math.sin(a), y: d.x * Math.sin(a) + d.y * Math.cos(a) };

  // Practice strokes with the player's shadow over the cue ball end.
  const shadow = { c: { x: cue0.x - d.x * 1.2, y: cue0.y - d.y * 1.2 }, rx: 1.2, ry: 0.7 };
  for (let i = 0; i < 30; i++) {
    const gap = R + 0.04 + 0.25 * (0.5 + 0.5 * Math.sin(i / 3));
    feed({
      cue: cue0,
      obj: ob0,
      others,
      gain: 0.92,
      shadow,
      stick: { tip: { x: cue0.x - d.x * gap, y: cue0.y - d.y * gap }, dir: d },
    });
  }
  check(`${opts.label}: practice strokes don't trigger a shot`, snap.phase === "armed", snap.phase);

  // The shot.
  const cb: Ball = { p: { ...cue0 }, v: { x: d.x * opts.speed, y: d.y * opts.speed }, in: true };
  const ob: Ball = { p: { ...ob0 }, v: { x: 0, y: 0 }, in: true };
  let contacted = false;
  let obDir: Pt | null = null;
  let frames = 0;
  let stickTip: Pt = { ...cue0 };
  while (snap.phase !== "done" && frames < 600) {
    for (let sub = 0; sub < 8; sub++) {
      const dt = 1 / 30 / 8;
      stepBall(cb, dt);
      stepBall(ob, dt);
      if (!contacted && cb.in && Math.hypot(cb.p.x - ob.p.x, cb.p.y - ob.p.y) <= 2 * R) {
        contacted = true;
        const n = { x: ob.p.x - cb.p.x, y: ob.p.y - cb.p.y };
        const nm = Math.hypot(n.x, n.y);
        n.x /= nm;
        n.y /= nm;
        const vn = cb.v.x * n.x + cb.v.y * n.y;
        ob.v = { x: n.x * vn, y: n.y * vn };
        obDir = n;
        const tan = { x: cb.v.x - n.x * vn, y: cb.v.y - n.y * vn };
        // Follow/draw keeps some of the incoming speed along the old line.
        cb.v = { x: tan.x + n.x * vn * opts.follow, y: tan.y + n.y * vn * opts.follow };
      }
    }
    // Stick follows through a little then lifts away.
    stickTip = frames < 4 ? { x: stickTip.x + d.x * 0.08, y: stickTip.y + d.y * 0.08 } : stickTip;
    feed({
      cue: cb.in ? cb.p : null,
      obj: ob.in ? ob.p : null,
      others,
      gain: 0.92,
      shadow,
      stick: frames < 12 ? { tip: stickTip, dir: d } : null,
    });
    frames++;
  }
  check(`${opts.label}: shot finishes`, snap.phase === "done", { phase: snap.phase, frames });
  if (snap.phase !== "done") return null;
  const report = analyzeShot(shot, snap.recording, { ballR: R, inchesPerDiamond: TABLE_SIZES[7].inchesPerDiamond });
  // True signed deviation of the OB's line from the line into the pocket.
  const ideal = { x: (pk.x - ob0.x) / toPk, y: (pk.y - ob0.y) / toPk };
  const trueDev = obDir
    ? (Math.atan2(ideal.x * obDir.y - ideal.y * obDir.x, ideal.x * obDir.x + ideal.y * obDir.y) * 180) / Math.PI
    : null;
  return { report, truth: { obIn: !ob.in, cbIn: !cb.in, cbFinal: cb.p, trueDev } };
}

const stop = getShot("basic-stop-shot")!;

{
  const r = runShot(stop, { aimErrDeg: 0, speed: 5, follow: 0, label: "stop shot, perfect aim" });
  if (r) {
    check("perfect: verdict make", r.report.verdict === "make", r.report);
    check("perfect: aim error < 1°", !!r.report.aim && Math.abs(r.report.aim.errorDeg) < 1, r.report.aim);
    check(
      "perfect: cue ball position measured within 0.1◆",
      !!r.report.position && Math.hypot(r.report.position.actual.x - r.truth.cbFinal.x, r.report.position.actual.y - r.truth.cbFinal.y) < 0.1,
      { pos: r.report.position, truth: r.truth.cbFinal },
    );
    console.log("   ", r.report.headline, "|", r.report.tips.join(" | "), "| score", r.report.score);
  }
}

{
  const r = runShot(stop, { aimErrDeg: 1.6, speed: 5, follow: 0.35, label: "stop shot, mis-aimed + follow" });
  if (r) {
    check("mis-aim: verdict matches physics", (r.report.verdict === "make") === (r.truth.obIn && !r.truth.cbIn), { v: r.report.verdict, truth: r.truth });
    check(
      "mis-aim: measured cut error within 1° of the true deviation",
      !!r.report.aim && r.truth.trueDev !== null && Math.abs(Math.abs(r.report.aim.errorDeg) - Math.abs(r.truth.trueDev)) < 1,
      { aim: r.report.aim, trueDev: r.truth.trueDev },
    );
    check("mis-aim: position says long", !!r.report.position && r.report.position.along > 0.3, r.report.position);
    console.log("   ", r.report.headline, "|", r.report.tips.join(" | "), "| score", r.report.score);
  }
}

{
  const cut = getShot("pocket-speed-diagonal") ?? stop;
  const r = runShot(cut, { aimErrDeg: 0, speed: 4, follow: 0, label: `${cut.id}, perfect aim` });
  if (r) {
    check(`${cut.id}: verdict matches physics`, (r.report.verdict === "make") === (r.truth.obIn && !r.truth.cbIn), { v: r.report.verdict, truth: r.truth });
    console.log("   ", r.report.headline, "|", r.report.tips.join(" | "), "| score", r.report.score);
  }
}

{
  // Off-spot setup must not auto-arm.
  const crop = tableCrop(Htf, FW, FH);
  const vision = new TableVision(Htf, crop, R);
  const tracker = new ShotTracker({ ballR: R, expectedCue: stop.cueBall, expectedObject: stop.objectBall });
  let snap: TrackerSnapshot = tracker.snapshot();
  for (let i = 0; i < 40; i++) {
    vision.ingest(cropOf(render({ cue: { x: 5.5, y: 2 }, obj: stop.objectBall }), crop));
    snap = tracker.step(vision, 1000 + i * 33);
  }
  check("off-spot: stays in setup", snap.phase === "setup", snap.phase);
  check(
    "off-spot: still reports where the balls are",
    snap.phase === "setup" && !!snap.setup.cue && Math.hypot(snap.setup.cue.x - 5.5, snap.setup.cue.y - 2) < 0.08 && !snap.setup.cueOnSpot,
    snap.phase === "setup" ? snap.setup : null,
  );
}

{
  // Auto-calibration finds the table corners on a plain frame.
  const frame = render({ cue: { x: 2, y: 2 }, obj: { x: 5, y: 1 } });
  const found = detectCornerPockets({ data: frame, width: FW, height: FH } as unknown as ImageData);
  const worst = found ? Math.max(...screen.map((s) => Math.min(...found.map((f) => Math.hypot(f.x - s.x, f.y - s.y))))) : Infinity;
  check("auto-calibration lands within 12px of every corner", worst < 12, { found, worst });
}

console.log(fail === 0 ? "ALL CV TRACKER TESTS PASSED" : `${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
