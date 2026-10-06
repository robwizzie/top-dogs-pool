"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Crosshair,
  Eye,
  EyeOff,
  Hand,
  Loader2,
  Radar,
  RotateCcw,
  ScanLine,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { KinisterShot } from "@/lib/kinister/shots";
import {
  applyHomography,
  computeHomography,
  invertHomography,
  type Homography,
} from "@/lib/kinister/homography";
import {
  ballRadius,
  CAMERA_SIDES,
  containMap,
  displayToVideo,
  orderScreenCorners,
  TABLE_SIZES,
  tableCornersFor,
  videoToDisplay,
  type CameraSide,
  type Pt,
  type TableSize,
} from "@/lib/cv/table";
import { TableVision, tableCrop, RECT_W, RECT_H } from "@/lib/cv/vision";
import { ShotTracker, type SetupView, type TrackerSnapshot } from "@/lib/cv/shotTracker";
import { analyzeShot, type ShotReport } from "@/lib/cv/shotAnalysis";
import { detectCornerPockets } from "@/lib/cv/detect";
import {
  correctSessionAttempt,
  logSessionAttempt,
  logSessionCritique,
} from "@/lib/kinister/useSession";
import { useShotStats } from "@/lib/kinister/useShotStats";
import { playMake, playMiss, playReady, playUncertain, primeAudio } from "@/lib/sound/effects";
import { cn } from "@/lib/utils";
import { drawGrid, drawGuides, drawLive, drawReport, makeProjector, screenRadius } from "./draw";
import { ResultPanel, type CoachState } from "./ResultPanel";

/**
 * AR shot trainer.
 *
 *   1. Calibrate: the four corner pockets are found automatically (or
 *      tapped), then dragged into place with a magnifier. A diamond grid
 *      drawn over the live feed shows whether it lines up.
 *   2. Set up: rings show where the cue ball and object ball go. Once
 *      both sit on their spots and stay still, tracking arms by itself.
 *   3. Shoot: both balls are tracked every frame in table space.
 *   4. Feedback: make/miss, over/under-cut in degrees, where the cue ball
 *      stopped vs the target, rails, speed — drawn on the table and
 *      logged to practice stats. Re-rack and the next shot arms itself.
 */

type Stage = "gate" | "calibrate" | "live";

type Result = {
  report: ShotReport;
  frames: string[];
  loggedAs: "make" | "miss" | null;
  coach: CoachState;
};

/** Longest edge of the frame we process. */
const PROC_MAX = 960;

function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // storage unavailable — keep the default
    }
  }, [key]);
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // ignore
      }
    },
    [key],
  );
  return [value, set];
}

export function ShotAR({ shot }: { shot: KinisterShot }) {
  const [stage, setStage] = useState<Stage>("gate");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState({ w: 0, h: 0 });

  const [side, setSide] = usePersisted<CameraSide>("td-ar-camera-side", "head");
  const [tableSize, setTableSize] = usePersisted<TableSize>("td-ar-table-size", 7);
  const [points, setPoints] = useState<Pt[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectNote, setDetectNote] = useState<string | null>(null);

  const r = ballRadius(tableSize);
  const inchesPerDiamond = TABLE_SIZES[tableSize].inchesPerDiamond;

  const Htv: Homography | null = useMemo(() => {
    if (points.length !== 4) return null;
    try {
      return computeHomography(tableCornersFor(side), orderScreenCorners(points));
    } catch {
      return null;
    }
  }, [points, side]);
  const map = useMemo(() => containMap(videoSize.w, videoSize.h, box.w, box.h), [videoSize, box]);
  const project = useMemo(() => (Htv ? makeProjector(Htv, map) : null), [Htv, map]);

  // ---------- camera ----------

  const startCamera = useCallback(async () => {
    primeAudio();
    setCameraError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      setStream(s);
      setStage("calibrate");
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "Could not access the camera");
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    const onMeta = () => setVideoSize({ w: v.videoWidth, h: v.videoHeight });
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("resize", onMeta);
    if (v.videoWidth) onMeta();
    void v.play().catch(() => {});
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("resize", onMeta);
    };
  }, [stream, stage]);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBox({ w: rect.width, h: rect.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage]);

  // Keep the screen on while the phone sits on a tripod.
  useEffect(() => {
    if (stage === "gate") return;
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        const wl = (navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
        }).wakeLock;
        lock = (await wl?.request("screen")) ?? null;
      } catch {
        // not supported / denied — fine
      }
    };
    void request();
    const onVis = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, [stage]);

  // ---------- calibration ----------

  const autoDetect = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setDetecting(true);
    setDetectNote(null);
    // Let the frame paint before the (synchronous) detection pass.
    setTimeout(() => {
      const scale = Math.min(1, 640 / v.videoWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return setDetecting(false);
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const found = detectCornerPockets(ctx.getImageData(0, 0, c.width, c.height));
      setDetecting(false);
      if (found && found.length === 4) {
        setPoints(found.map((p) => ({ x: p.x / scale, y: p.y / scale })));
        setDetectNote("Found the table — drag any corner that's off onto the pocket.");
      } else {
        setDetectNote("Couldn't find the table edges. Tap the four corner pockets.");
      }
    }, 50);
  }, []);

  // Auto-detect once the camera is up.
  const triedDetect = useRef(false);
  useEffect(() => {
    if (stage !== "calibrate" || !videoSize.w || triedDetect.current || points.length) return;
    triedDetect.current = true;
    const t = setTimeout(autoDetect, 900);
    return () => clearTimeout(t);
  }, [stage, videoSize.w, points.length, autoDetect]);

  // ---------- live tracking ----------

  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const debugRef = useRef<HTMLCanvasElement | null>(null);
  const visionRef = useRef<TableVision | null>(null);
  const trackerRef = useRef<ShotTracker | null>(null);
  const [phase, setPhase] = useState<TrackerSnapshot["phase"]>("setup");
  const [setup, setSetup] = useState<SetupView | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<Result | null>(null);
  resultRef.current = result;
  const [resultOpen, setResultOpen] = useState(true);
  const [guides, setGuides] = usePersisted("td-ar-guides", true);
  const [sound, setSound] = usePersisted("td-ar-sound", true);
  const [debug, setDebug] = useState(false);
  const [pick, setPick] = useState<null | { cue: Pt | null }>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<{ verdict: "make" | "miss" | "uncertain"; shape: number | null }[]>([]);
  const settingsRef = useRef({ guides, sound, debug });
  settingsRef.current = { guides, sound, debug };
  // Read by the frame loop so a resize/rotation re-projects the overlay
  // without restarting the tracker mid-shot.
  const projectRef = useRef(project);
  projectRef.current = project;

  const { logMake, logMiss, correctLast } = useShotStats(shot.id);
  const logRef = useRef({ logMake, logMiss });
  logRef.current = { logMake, logMiss };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (stage !== "live" || !Htv || !videoSize.w) return;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    const procScale = Math.min(1, PROC_MAX / Math.max(videoSize.w, videoSize.h));
    const procW = Math.round(videoSize.w * procScale);
    const procH = Math.round(videoSize.h * procScale);
    const Htp: Homography = [
      Htv[0] * procScale, Htv[1] * procScale, Htv[2] * procScale,
      Htv[3] * procScale, Htv[4] * procScale, Htv[5] * procScale,
      Htv[6], Htv[7], Htv[8],
    ];
    const crop = tableCrop(Htp, procW, procH);
    const vision = new TableVision(Htp, crop, r);
    const tracker = new ShotTracker({ ballR: r, expectedCue: shot.cueBall, expectedObject: shot.objectBall });
    visionRef.current = vision;
    trackerRef.current = tracker;

    const work = document.createElement("canvas");
    work.width = crop.w;
    work.height = crop.h;
    const wctx = work.getContext("2d", { willReadFrequently: true });
    const thumb = document.createElement("canvas");
    const tScale = Math.min(1, 480 / videoSize.w);
    thumb.width = Math.round(videoSize.w * tScale);
    thumb.height = Math.round(videoSize.h * tScale);
    const tctx = thumb.getContext("2d");
    const thumbs: { t: number; url: string }[] = [];
    let lastThumb = 0;
    let lastPhase: TrackerSnapshot["phase"] = "setup";
    let lastSetupKey = "";
    let doneAt = 0;
    let stopped = false;
    let handle = 0;
    const debugImg = new ImageData(RECT_W, RECT_H);

    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const frame = () => {
      if (stopped || !wctx) return;
      if (video.readyState >= 2) {
        wctx.drawImage(
          video,
          crop.x / procScale, crop.y / procScale, crop.w / procScale, crop.h / procScale,
          0, 0, crop.w, crop.h,
        );
        vision.ingest(wctx.getImageData(0, 0, crop.w, crop.h).data);
        const now = performance.now();
        const snap = tracker.step(vision, now);

        // Thumbnails around the shot for the AI coach.
        if ((snap.phase === "armed" || snap.phase === "in-shot") && tctx && now - lastThumb > 120) {
          lastThumb = now;
          tctx.drawImage(video, 0, 0, thumb.width, thumb.height);
          try {
            thumbs.push({ t: now, url: thumb.toDataURL("image/jpeg", 0.6) });
          } catch {
            // tainted canvas — no coach frames, tracking unaffected
          }
          while (thumbs.length > 60) thumbs.shift();
        }

        if (snap.phase !== lastPhase) {
          if (snap.phase === "armed") {
            if (settingsRef.current.sound) playReady();
            setResultOpen(false);
          }
          if (snap.phase === "done") {
            doneAt = now;
            const rec = snap.recording;
            const report = analyzeShot(shot, rec, { ballR: r, inchesPerDiamond });
            const shotThumbs = thumbs.filter((f) => f.t >= rec.startedAt - 700 && f.t <= rec.endedAt);
            const pickN = 10;
            const frames =
              shotThumbs.length <= pickN
                ? shotThumbs.map((f) => f.url)
                : Array.from(
                    { length: pickN },
                    (_, i) => shotThumbs[Math.round((i * (shotThumbs.length - 1)) / (pickN - 1))].url,
                  );
            thumbs.length = 0;
            let loggedAs: "make" | "miss" | null = null;
            if (report.verdict === "make") {
              logRef.current.logMake();
              logSessionAttempt(shot.id, true);
              loggedAs = "make";
              if (settingsRef.current.sound) playMake();
            } else if (report.verdict === "miss") {
              logRef.current.logMiss();
              logSessionAttempt(shot.id, false);
              loggedAs = "miss";
              if (settingsRef.current.sound) playMiss();
            } else if (settingsRef.current.sound) {
              playUncertain();
            }
            setResult({ report, frames, loggedAs, coach: { kind: "idle" } });
            setResultOpen(true);
            setHistory((h) => [...h, { verdict: loggedAs ?? "uncertain", shape: report.position?.error ?? null }]);
          }
          lastPhase = snap.phase;
          setPhase(snap.phase);
        }
        // After a result, start looking for the next setup.
        if (snap.phase === "done" && now - doneAt > 2500) tracker.reset(now);

        if (snap.phase === "setup") {
          const s = snap.setup;
          const key = `${!!s.cue}${!!s.object}${s.cueOnSpot}${s.objectOnSpot}${s.steady}`;
          if (key !== lastSetupKey) {
            lastSetupKey = key;
            setSetup(s);
          }
        }

        // Draw.
        const w = overlay.clientWidth;
        const h = overlay.clientHeight;
        if (overlay.width !== Math.round(w * dpr) || overlay.height !== Math.round(h * dpr)) {
          overlay.width = Math.round(w * dpr);
          overlay.height = Math.round(h * dpr);
        }
        const ctx = overlay.getContext("2d");
        const proj = projectRef.current;
        if (ctx && proj) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);
          const res = resultRef.current;
          if (settingsRef.current.guides && (snap.phase === "setup" || snap.phase === "armed") && !res) {
            drawGuides(ctx, proj, shot, r);
          }
          if (res && (snap.phase === "setup" || snap.phase === "done")) {
            ctx.globalAlpha = snap.phase === "setup" ? 0.55 : 1;
            drawReport(ctx, proj, shot, r, res.report);
            ctx.globalAlpha = 1;
          }
          drawLive(ctx, proj, snap, shot, r, null);
        }
        const dbg = debugRef.current;
        if (settingsRef.current.debug && dbg) {
          vision.renderDebug(debugImg.data);
          const dctx = dbg.getContext("2d");
          dctx?.putImageData(debugImg, 0, 0);
        }
      }
      handle = schedule();
    };
    const v = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (h: number) => void;
    };
    const schedule = () =>
      v.requestVideoFrameCallback ? v.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
    handle = schedule();
    return () => {
      stopped = true;
      if (v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
      visionRef.current = null;
      trackerRef.current = null;
    };
  }, [stage, Htv, videoSize.w, videoSize.h, r, inchesPerDiamond, shot]);

  // ---------- actions ----------

  function armAsPlaced() {
    const t = trackerRef.current;
    const v = visionRef.current;
    if (!t || !v) return;
    if (!t.armNow(v, performance.now())) setToast("Need to see both the cue ball and the object ball.");
  }

  function cancelArm() {
    trackerRef.current?.reset(performance.now(), 0);
    setPhase("setup");
  }

  function override(verdict: "make" | "miss") {
    if (!result) return;
    const was = result.loggedAs;
    if (was === verdict) return;
    if (was === null) {
      if (verdict === "make") {
        logMake();
        logSessionAttempt(shot.id, true);
      } else {
        logMiss();
        logSessionAttempt(shot.id, false);
      }
    } else {
      correctLast(was === "make", verdict === "make");
      correctSessionAttempt(shot.id, was === "make", verdict === "make");
    }
    setResult({ ...result, loggedAs: verdict });
    setHistory((h) => (h.length ? [...h.slice(0, -1), { ...h[h.length - 1], verdict }] : h));
    if (sound) (verdict === "make" ? playMake : playMiss)();
  }

  async function askCoach() {
    if (!result || result.frames.length === 0) return;
    const current = result;
    setResult({ ...current, coach: { kind: "loading" } });
    const rep = current.report;
    try {
      const res = await fetch("/api/shot-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: shot.id,
          frames: current.frames,
          metrics: {
            verdict: current.loggedAs ?? rep.verdict,
            headline: rep.headline,
            aim: rep.aim,
            position: rep.position && {
              error: rep.position.error,
              along: rep.position.along,
              across: rep.position.across,
            },
            rails: rep.rails,
            speed: rep.speedLabel,
            scratch: rep.scratch,
            tableSize: TABLE_SIZES[tableSize].label,
          },
        }),
      });
      const data = await res.json();
      const coach: CoachState = data.ok
        ? { kind: "done", verdict: data.verdict, summary: data.summary }
        : { kind: "error", message: data.error ?? "The coach couldn't review this one." };
      setResult((cur) => (cur && cur.report === rep ? { ...cur, coach } : cur));
      if (data.ok) logSessionCritique(shot.id, { verdict: data.verdict, summary: data.summary });
    } catch (err) {
      const coach: CoachState = {
        kind: "error",
        message: err instanceof Error ? err.message : "Network error reaching the coach",
      };
      setResult((cur) => (cur && cur.report === rep ? { ...cur, coach } : cur));
    }
  }

  function onLiveTap(e: React.PointerEvent<HTMLDivElement>) {
    if (!pick || !Htv) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const vp = displayToVideo(map, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    const tp = applyHomography(invertHomography(Htv), vp);
    if (!pick.cue) {
      setPick({ cue: tp });
      return;
    }
    const t = trackerRef.current;
    const v = visionRef.current;
    setPick(null);
    if (!t || !v || !t.armAt(v, performance.now(), pick.cue, tp)) {
      setToast("Couldn't find a ball where you tapped — try again.");
    }
  }

  function recalibrate() {
    setResult(null);
    setPhase("setup");
    setSetup(null);
    setPick(null);
    setStage("calibrate");
  }

  // ---------- render ----------

  if (stage === "gate") {
    return <Gate shot={shot} onStart={startCamera} error={cameraError} />;
  }

  const made = history.filter((h) => h.verdict === "make").length;
  const shapes = history.map((h) => h.shape).filter((s): s is number => s !== null);
  const avgShape = shapes.length ? shapes.reduce((a, b) => a + b, 0) / shapes.length : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <header className="flex items-center gap-2 border-b border-white/10 bg-black/70 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link
          href={`/shots/${shot.id}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 hover:text-[var(--color-brass-bright)]"
        >
          <ArrowLeft size={14} />
          Back
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass-bright)]">
          {String(shot.number).padStart(2, "0")} · {shot.name}
        </p>
        {stage === "live" && (
          <div className="flex items-center gap-1">
            <IconButton label={guides ? "Hide guides" : "Show guides"} onClick={() => setGuides(!guides)}>
              {guides ? <Eye size={16} /> : <EyeOff size={16} />}
            </IconButton>
            <IconButton label={sound ? "Mute" : "Unmute"} onClick={() => setSound(!sound)}>
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </IconButton>
            <IconButton label="Tracking view" active={debug} onClick={() => setDebug(!debug)}>
              <Radar size={16} />
            </IconButton>
            <IconButton label="Recalibrate" onClick={recalibrate}>
              <RotateCcw size={16} />
            </IconButton>
          </div>
        )}
      </header>

      <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-contain"
        />

        {stage === "calibrate" && (
          <Calibration
            videoRef={videoRef}
            points={points}
            setPoints={setPoints}
            map={map}
            box={box}
            Htv={Htv}
            shot={shot}
            r={r}
          />
        )}

        {stage === "live" && (
          <>
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            <div
              className={cn("absolute inset-0", pick && "cursor-crosshair")}
              onPointerUp={onLiveTap}
            />
            {history.length > 0 && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/85 backdrop-blur">
                {made}/{history.length} made
                {avgShape !== null && <span className="text-white/55"> · avg shape {avgShape.toFixed(2)}◆</span>}
              </div>
            )}
            {debug && (
              <canvas
                ref={debugRef}
                width={RECT_W}
                height={RECT_H}
                className="pointer-events-none absolute right-3 top-3 w-[min(46vw,320px)] rounded-lg border border-white/20"
                style={{ aspectRatio: `${RECT_W} / ${RECT_H}` }}
              />
            )}
            {!(result && resultOpen && (phase === "done" || phase === "setup")) && (
              <div
                className={cn(
                  "pointer-events-none absolute z-10",
                  phase === "setup" && !pick
                    ? "left-3 top-12 w-[min(17rem,calc(100%-1.5rem))]"
                    : "inset-x-0 top-3 flex justify-center px-3",
                )}
              >
                <LivePanel
                  phase={phase}
                  setup={setup}
                  pick={pick}
                  onArmAsPlaced={armAsPlaced}
                  onPick={() => setPick(pick ? null : { cue: null })}
                  onCancel={cancelArm}
                  onShowResult={result ? () => setResultOpen(true) : null}
                />
              </div>
            )}
            {toast && (
              <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center">
                <p className="rounded-full bg-black/80 px-4 py-2 text-sm">{toast}</p>
              </div>
            )}
          </>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex max-h-[62%] justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {stage === "calibrate" ? (
            <CalibrationPanel
              count={points.length}
              detecting={detecting}
              note={detectNote}
              side={side}
              setSide={setSide}
              tableSize={tableSize}
              setTableSize={setTableSize}
              onDetect={autoDetect}
              onClear={() => {
                setPoints([]);
                setDetectNote(null);
              }}
              onDone={() => setStage("live")}
            />
          ) : result && resultOpen && (phase === "done" || phase === "setup") ? (
            <ResultPanel
              report={result.report}
              inchesPerDiamond={inchesPerDiamond}
              loggedAs={result.loggedAs}
              onOverride={override}
              coach={result.coach}
              canCoach={result.frames.length > 0}
              onCoach={askCoach}
              onDismiss={() => setResultOpen(false)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------- calibration ----------

function Calibration({
  videoRef,
  points,
  setPoints,
  map,
  box,
  Htv,
  shot,
  r,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  points: Pt[];
  setPoints: (p: Pt[]) => void;
  map: ReturnType<typeof containMap>;
  box: { w: number; h: number };
  Htv: Homography | null;
  shot: KinisterShot;
  r: number;
}) {
  const gridRef = useRef<HTMLCanvasElement | null>(null);
  const loupeRef = useRef<HTMLCanvasElement | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [dragAt, setDragAt] = useState<Pt | null>(null);

  // Grid + where the balls go, so a flipped or skewed calibration shows.
  useEffect(() => {
    const c = gridRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(box.w * dpr);
    c.height = Math.round(box.h * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box.w, box.h);
    if (!Htv) return;
    const project = makeProjector(Htv, map);
    drawGrid(ctx, project);
    for (const [p, color, name] of [
      [shot.cueBall, "rgba(255,255,255,0.95)", "CB"],
      [shot.objectBall, "rgba(240,196,84,0.95)", "OB"],
    ] as const) {
      const sp = project(p);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, screenRadius(project, p, r), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "600 11px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(name, sp.x, sp.y - screenRadius(project, p, r) - 6);
    }
  }, [Htv, map, box, shot, r]);

  // Magnifier while dragging — your finger hides the exact spot.
  useEffect(() => {
    if (drag === null || !dragAt) return;
    const v = videoRef.current;
    const c = loupeRef.current;
    if (!v || !c) return;
    let raf = 0;
    const draw = () => {
      const ctx = c.getContext("2d");
      if (ctx && v.videoWidth) {
        const zoom = 3;
        const size = c.width;
        const src = size / zoom / map.scale;
        ctx.drawImage(v, dragAt.x - src / 2, dragAt.y - src / 2, src, src, 0, 0, size, size);
        ctx.strokeStyle = "rgba(232,82,72,0.95)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(size / 2, 0);
        ctx.lineTo(size / 2, size);
        ctx.moveTo(0, size / 2);
        ctx.lineTo(size, size / 2);
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [drag, dragAt, map.scale, videoRef]);

  const toLocal = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    const p = toLocal(e);
    // Grab the nearest handle within reach…
    let best = -1;
    let bestD = 36;
    points.forEach((q, i) => {
      const d = Math.hypot(videoToDisplay(map, q).x - p.x, videoToDisplay(map, q).y - p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag(best);
      setDragAt(points[best]);
      return;
    }
    // …or drop a new corner.
    if (points.length < 4) {
      const vp = displayToVideo(map, p);
      setPoints([...points, vp]);
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag(points.length);
      setDragAt(vp);
    }
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (drag === null) return;
    const vp = displayToVideo(map, toLocal(e));
    setDragAt(vp);
    const next = points.slice();
    next[drag] = vp;
    setPoints(next);
  }

  function onUp() {
    setDrag(null);
    setDragAt(null);
  }

  const dragDisplay = dragAt ? videoToDisplay(map, dragAt) : null;
  const ordered = points.length === 4 ? orderScreenCorners(points) : null;

  return (
    <>
      <canvas ref={gridRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {ordered && (
            <polygon
              points={ordered.map((q) => { const d = videoToDisplay(map, q); return `${d.x},${d.y}`; }).join(" ")}
              fill="rgba(201,162,74,0.06)"
              stroke="none"
            />
          )}
          {points.map((q, i) => {
            const d = videoToDisplay(map, q);
            return (
              <g key={i}>
                <circle cx={d.x} cy={d.y} r={22} fill="rgba(0,0,0,0.25)" stroke="rgba(255,235,180,0.95)" strokeWidth={2} />
                <circle cx={d.x} cy={d.y} r={3} fill="rgba(232,82,72,1)" />
              </g>
            );
          })}
        </svg>
      </div>
      {drag !== null && dragDisplay && (
        <canvas
          ref={loupeRef}
          width={150}
          height={150}
          className="pointer-events-none absolute h-[120px] w-[120px] rounded-full border-2 border-white/80 shadow-xl"
          style={{
            left: Math.min(box.w - 130, Math.max(10, dragDisplay.x - 60)),
            top: dragDisplay.y > 170 ? dragDisplay.y - 160 : dragDisplay.y + 40,
          }}
        />
      )}
    </>
  );
}

function CalibrationPanel({
  count,
  detecting,
  note,
  side,
  setSide,
  tableSize,
  setTableSize,
  onDetect,
  onClear,
  onDone,
}: {
  count: number;
  detecting: boolean;
  note: string | null;
  side: CameraSide;
  setSide: (s: CameraSide) => void;
  tableSize: TableSize;
  setTableSize: (s: TableSize) => void;
  onDetect: () => void;
  onClear: () => void;
  onDone: () => void;
}) {
  return (
    <div className="pointer-events-auto w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-black/80 p-3.5 backdrop-blur-md sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
        Calibrate · {count}/4 corners
      </p>
      <p className="mt-1 text-sm leading-snug text-white/90">
        {detecting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Looking for the table…
          </span>
        ) : count < 4 ? (
          note ?? "Tap the four corner pockets (any order) — where the cushion noses meet."
        ) : (
          note ?? "Drag any corner onto its pocket. The gold grid should sit on the rail diamonds."
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-white/55">Camera at</span>
          {CAMERA_SIDES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSide(s.id)}
              className={cn(
                "h-7 rounded-full border px-2.5 font-semibold",
                side === s.id
                  ? "border-[var(--color-brass)] bg-[var(--color-brass)]/20 text-[var(--color-brass-bright)]"
                  : "border-white/20 text-white/70 hover:bg-white/10",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/55">Table</span>
          {([7, 8, 9] as TableSize[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTableSize(s)}
              className={cn(
                "h-7 rounded-full border px-2.5 font-semibold",
                tableSize === s
                  ? "border-[var(--color-brass)] bg-[var(--color-brass)]/20 text-[var(--color-brass-bright)]"
                  : "border-white/20 text-white/70 hover:bg-white/10",
              )}
            >
              {TABLE_SIZES[s].label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-white/50">
        &ldquo;Camera at&rdquo; is the rail your phone is behind. Check the HEAD/FOOT labels and the CB/OB rings
        land where the drill puts them.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={count < 4}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-felt-bright)]/60 bg-[var(--color-felt-deep)]/80 px-4 text-sm font-semibold text-[var(--color-felt-bright)] hover:bg-[var(--color-felt-deep)] disabled:opacity-40"
        >
          <Crosshair size={15} /> Start training
        </button>
        <button
          type="button"
          onClick={onDetect}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold hover:bg-white/20"
        >
          <ScanLine size={14} /> Auto-find
        </button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold hover:bg-white/20"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ---------- live HUD ----------

function LivePanel({
  phase,
  setup,
  pick,
  onArmAsPlaced,
  onPick,
  onCancel,
  onShowResult,
}: {
  phase: TrackerSnapshot["phase"];
  setup: SetupView | null;
  pick: { cue: Pt | null } | null;
  onArmAsPlaced: () => void;
  onPick: () => void;
  onCancel: () => void;
  onShowResult: (() => void) | null;
}) {
  if (pick) {
    return (
      <Pill tone="brass">
        {pick.cue ? "Now tap the object ball" : "Tap the cue ball"}
        <PillButton onClick={onPick}>Cancel</PillButton>
      </Pill>
    );
  }
  if (phase === "armed") {
    return (
      <Pill tone="good" pulse>
        Ready — take your shot
        <PillButton onClick={onCancel}>Reset</PillButton>
      </Pill>
    );
  }
  if (phase === "in-shot" || phase === "done") {
    return <Pill tone="brass">Tracking…</Pill>;
  }
  const s = setup;
  const seenBoth = !!s?.cue && !!s?.object;
  return (
    <Panel tone="neutral" title="Set up the shot">
      <ul className="mt-1 space-y-1 text-[13px]">
        <Check ok={!!s?.cueOnSpot} seen={!!s?.cue}>Cue ball on its ring</Check>
        <Check ok={!!s?.objectOnSpot} seen={!!s?.object}>Object ball on its ring</Check>
        <Check ok={!!s?.steady} seen={seenBoth}>Hands clear, balls still</Check>
      </ul>
      <p className="mt-1.5 text-[11px] leading-snug text-white/55">
        Tracking starts on its own once both balls sit on their rings.
      </p>
      <Actions>
        {seenBoth && !(s?.cueOnSpot && s?.objectOnSpot) && (
          <SmallButton onClick={onArmAsPlaced} primary>
            Start with balls as placed
          </SmallButton>
        )}
        <SmallButton onClick={onPick}>
          <Hand size={13} /> Tap the balls
        </SmallButton>
        {onShowResult && <SmallButton onClick={onShowResult}>Last result</SmallButton>}
      </Actions>
    </Panel>
  );
}

function Pill({
  tone,
  pulse,
  children,
}: {
  tone: "good" | "brass";
  pulse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto inline-flex items-center gap-2.5 rounded-full border bg-black/80 py-1.5 pl-3.5 pr-1.5 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur-md",
        tone === "good" ? "border-emerald-400/60 text-emerald-300" : "border-[var(--color-brass)]/60 text-[var(--color-brass-bright)]",
      )}
    >
      {pulse && <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
      {children}
    </div>
  );
}

function PillButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 rounded-full border border-white/20 bg-white/10 px-2.5 text-[11px] font-semibold normal-case tracking-normal text-white hover:bg-white/20"
    >
      {children}
    </button>
  );
}

function Check({ ok, seen, children }: { ok: boolean; seen: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
          ok ? "bg-emerald-500 text-black" : seen ? "bg-amber-400 text-black" : "bg-white/15 text-white/60",
        )}
      >
        {ok ? "✓" : seen ? "!" : ""}
      </span>
      <span className={ok ? "text-white" : "text-white/75"}>{children}</span>
    </li>
  );
}

function Panel({
  tone,
  title,
  pulse,
  children,
}: {
  tone: "good" | "brass" | "neutral";
  title: string;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-xl rounded-2xl border bg-black/75 px-3.5 py-2.5 text-sm text-white/90 backdrop-blur-md",
        tone === "good" && "border-emerald-400/50",
        tone === "brass" && "border-[var(--color-brass)]/50",
        tone === "neutral" && "border-white/15",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em]",
          tone === "good" ? "text-emerald-300" : "text-[var(--color-brass-bright)]",
        )}
      >
        {pulse && <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
        {title}
      </p>
      <div className="mt-1 leading-snug">{children}</div>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>;
}

function SmallButton({
  onClick,
  primary,
  children,
}: {
  onClick: () => void;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
        primary
          ? "border-[var(--color-felt-bright)]/60 bg-[var(--color-felt-deep)]/80 text-[var(--color-felt-bright)]"
          : "border-white/20 bg-white/10 text-white hover:bg-white/20",
      )}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/80 hover:bg-white/10",
        active && "border-[var(--color-brass)] text-[var(--color-brass-bright)]",
      )}
    >
      {children}
    </button>
  );
}

// ---------- gate ----------

function Gate({ shot, onStart, error }: { shot: KinisterShot; onStart: () => void; error: string | null }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-12 sm:px-6">
      <Link
        href={`/shots/${shot.id}`}
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
      >
        <ArrowLeft size={14} />
        Back to {shot.name}
      </Link>
      <div className="surface space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Crosshair size={24} className="text-[var(--color-brass-bright)]" />
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-wide">AR Shot Trainer</h1>
        </div>
        <p className="text-sm leading-relaxed text-[var(--fg-dim)]">
          Prop your phone up so it sees the whole table. It tracks the cue ball and object ball through every
          shot and tells you whether you made it, how far you over- or under-cut it, and where the cue ball
          stopped compared to where it should have.
        </p>
        <ul className="space-y-2 text-xs leading-relaxed text-[var(--fg-dim)]">
          <li className="flex gap-2">
            <span className="text-[var(--color-brass-bright)]">1.</span>
            Phone on a stand or propped up, landscape, behind a rail and as high as you can get it. All four
            corner pockets in frame.
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--color-brass-bright)]">2.</span>
            Line the grid up with the table once. Don&apos;t move the phone after that.
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--color-brass-bright)]">3.</span>
            Put the balls on their rings and shoot. Re-rack and it arms itself for the next one.
          </li>
        </ul>
        {error && (
          <p className="rounded-lg border border-[var(--color-pop)]/50 bg-[var(--color-pop)]/10 p-3 text-xs text-[var(--color-pop-bright)]">
            Couldn&apos;t open the camera: {error}. If you blocked camera access, re-enable it in your browser&apos;s
            site settings and try again.
          </p>
        )}
        <button
          type="button"
          onClick={onStart}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-5 text-sm font-semibold tracking-wide text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)]"
        >
          <Camera size={14} />
          {error ? "Try again" : "Start camera"}
        </button>
      </div>
    </div>
  );
}
