/**
 * Bert Kinister shot catalog.
 *
 * Coordinates use a diamond grid: x ∈ [0, 8] long axis (0 = head rail,
 * 8 = foot rail), y ∈ [0, 4] short axis (0 = right rail, 4 = left rail
 * when viewed from the head). Pockets sit at the corners and side mid-rails.
 *
 * Kinister deliberately never published diagrams for the 60 Minute Workout
 * — the videos are the canonical source. Coordinates here match the verbal
 * setups he describes; treat the geometry as approximate and tune as your
 * friends drill them.
 */

export type DiamondCoord = { x: number; y: number };
export type PocketId = "TL" | "TR" | "BL" | "BR" | "ML" | "MR";

export const POCKETS: Record<PocketId, DiamondCoord> = {
  TR: { x: 0, y: 0 },
  TL: { x: 0, y: 4 },
  BR: { x: 8, y: 0 },
  BL: { x: 8, y: 4 },
  MR: { x: 4, y: 0 },
  ML: { x: 4, y: 4 },
};

export type Difficulty = "Foundational" | "Intermediate" | "Advanced";

export type KinisterShot = {
  id: string;
  number: number;
  name: string;
  shortName: string;
  series: string;
  difficulty: Difficulty;
  cueBall: DiamondCoord;
  objectBall: DiamondCoord;
  /** Pocket the object ball is targeting. `null` for safeties / kicks. */
  targetPocket: PocketId | null;
  /** Cue-ball waypoints AFTER contact (final element = resting position). */
  cueBallPath: DiamondCoord[];
  /** Optional object-ball waypoints (e.g. banks). If omitted, OB rolls to targetPocket. */
  objectBallPath?: DiamondCoord[];
  /** One-sentence setup blurb. */
  description: string;
  technique: string;
  commonMistakes: string[];
  tips: string[];
  teaches: string;
};

/**
 * Source video for a shot. `videoId` (YouTube) enables both deep-link and
 * embedded player. `url` is for shots whose source video is not on a public
 * YouTube channel — link out to Bert's streaming library instead.
 */
export type ShotVideo = {
  videoId?: string;
  url?: string;
  /** Optional start time in seconds (jumps to this shot within the video). */
  startSeconds?: number;
  /** Human-readable source label, e.g. "60 Minute Workout · YouTube". */
  label: string;
};

const KINISTER_VIDEOS = {
  sixtyMin: { videoId: "G6zBTXwTHGs", label: "60 Minute Workout · YouTube" },
  mightyX: { videoId: "VinL0GpyNk4", label: "The Mighty X · YouTube" },
  shotmakersA: {
    videoId: "De99jCUBO-k",
    label: "Shotmakers Workout · Part A",
  },
  shotmakersB: {
    videoId: "pRYfD9weMGs",
    label: "Shotmakers Workout · Part B",
  },
  shotmakersC: {
    videoId: "Gcg0pDeVc7I",
    label: "Shotmakers Workout · Part C",
  },
  secret9Ball: {
    videoId: "zswtpo41m3w",
    label: "Secret 9-Ball Knowledge",
  },
  middleGame: {
    videoId: "42_-zDA2vHU",
    label: "The Middle Game",
  },
  bertSite: {
    url: "https://bertkinister.com/services/",
    label: "Bert Kinister · Streaming Library",
  },
} as const satisfies Record<string, ShotVideo>;

/** Per-shot override: use a specific video instead of the series default. */
const SHOT_VIDEO_OVERRIDES: Record<string, keyof typeof KINISTER_VIDEOS> = {
  "force-follow": "shotmakersB",
  combination: "shotmakersC",
};

/** Per-shot start-time overrides (seconds). Fill in as we timestamp them. */
const SHOT_START_SECONDS: Record<string, number> = {};

/**
 * Resolve the source video for a shot. Looks up an override first, then
 * falls back to a series-based default. Layered so we can fine-tune
 * specific shots (and add timestamps) without touching every record.
 */
export function videoFor(shot: KinisterShot): ShotVideo {
  const override = SHOT_VIDEO_OVERRIDES[shot.id];
  const base: ShotVideo = override
    ? KINISTER_VIDEOS[override]
    : seriesDefault(shot.series);
  const startSeconds = SHOT_START_SECONDS[shot.id];
  return startSeconds !== undefined ? { ...base, startSeconds } : base;
}

function seriesDefault(series: string): ShotVideo {
  const s = series.toLowerCase();
  if (s.includes("60 minute")) return KINISTER_VIDEOS.sixtyMin;
  if (s.includes("mighty x")) return KINISTER_VIDEOS.mightyX;
  if (s.includes("shotmakers")) return KINISTER_VIDEOS.shotmakersA;
  if (s.includes("secret 9-ball") || s.includes("run out 9-ball")) {
    return KINISTER_VIDEOS.secret9Ball;
  }
  if (s.includes("middle game")) return KINISTER_VIDEOS.middleGame;
  return KINISTER_VIDEOS.bertSite;
}

/** Builds the watch link, including ?t= if a startSeconds was provided. */
export function watchUrl(video: ShotVideo): string {
  if (video.videoId) {
    const base = `https://www.youtube.com/watch?v=${video.videoId}`;
    return video.startSeconds
      ? `${base}&t=${Math.floor(video.startSeconds)}s`
      : base;
  }
  return video.url ?? "https://bertkinister.com/";
}

export const KINISTER_SHOTS: KinisterShot[] = [
  {
    id: "basic-stop-shot",
    number: 1,
    name: "Basic Stop Shot",
    shortName: "Stop Shot",
    series: "Top Dogs Workout",
    difficulty: "Foundational",
    cueBall: { x: 4, y: 0.3 },
    objectBall: { x: 1.5, y: 0.3 },
    targetPocket: "TR",
    cueBallPath: [{ x: 1.5, y: 0.3 }],
    description:
      "Cue ball and object ball on the same long rail, OB sitting just below the corner pocket. Pocket the OB and freeze the cue ball where the OB started — CB takes the place of OBJ.",
    technique:
      "Dead-center hit, medium pace. No follow, no draw — the cue ball must stop on contact.",
    commonMistakes: [
      "Hitting above center → CB rolls forward past the OB spot",
      "Decelerating into the ball → unintended draw",
      "Adding english that walks the CB off the rail line",
    ],
    tips: [
      "Pick the OB's spot as your CB resting target before you stroke",
      "Match speed to distance — just enough to send the OB to the pocket cleanly",
    ],
    teaches:
      "Pure center-ball contact and stop-shot speed control. The bedrock of every position play.",
  },
  {
    id: "pocket-speed-diagonal",
    number: 2,
    name: "Pocket Speed Diagonal",
    shortName: "Pocket Speed",
    series: "Top Dogs Workout",
    difficulty: "Foundational",
    cueBall: { x: 6, y: 1.8 },
    objectBall: { x: 2, y: 0.6 },
    targetPocket: "TR",
    cueBallPath: [{ x: 1.5, y: 0.5 }],
    description:
      "Diagonal shot from the lower half of the table up through center to the far corner. Pocket the OB at pocket speed — slow enough that even a partially blocked pocket (a chapstick on the edge) still accepts the ball.",
    technique:
      "Straight through center, soft pace. The slower you hit it, the larger the pocket plays.",
    commonMistakes: [
      "Hitting too hard — pocket shrinks and the OB rattles",
      "Steering the cue off the contact line",
    ],
    tips: [
      "Practice with a chapstick blocking part of the pocket edge to train accuracy",
      "Pocket speed is the goal — minimum speed that still rolls the OB in",
    ],
    teaches:
      "Pocket speed and target precision — slower speeds expose any aim error.",
  },
  {
    id: "power-draw-full-length",
    number: 2.5,
    name: "Power Draw — Full Length",
    shortName: "Power Draw",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 7, y: 3.5 },
    objectBall: { x: 3, y: 1 },
    targetPocket: "TR",
    cueBallPath: [{ x: 7, y: 3.5 }],
    description:
      "Cue ball near the corner pocket on the foot end; OB sits diagonally up-table. Pocket the OB in the far corner and draw the cue ball the full length of the table back to where it started.",
    technique:
      "Low draw, level cue, firm accelerating stroke. A square, full hit on the OB is critical at this distance.",
    commonMistakes: [
      "Jacking the butt up → miscue or curve",
      "Decelerating → draw dies before the cue ball makes it back",
      "Unintended english → OB drifts off line",
    ],
    tips: [
      "Keep the cue as level as possible and accelerate smoothly",
      "Aim the OB first — don't try to body-english the draw",
    ],
    teaches:
      "Long-distance draw under control — a true stroke check.",
  },
  {
    id: "inside-english-return",
    number: 3,
    name: "Inside English — Return to Center",
    shortName: "Inside English",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 3, y: 0.3 },
    objectBall: { x: 1, y: 0.3 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0, y: 2 },
      { x: 4, y: 2 },
    ],
    description:
      "Same rail-line setup as the stop shot, but apply inside (left) english. After pocketing the OB the cue ball runs off the short rail and returns to the center of the table for shape.",
    technique:
      "Left english (inside on a right-rail shot), medium pace. The english widens the rebound off the short rail so the cue ball comes back across to center.",
    commonMistakes: [
      "Too much english — CB throws the OB off the rail",
      "Wrong english — outside spin shortens the rebound and CB stays near the rail",
      "Hitting too hard and over-running center",
    ],
    tips: [
      "Inside english on a rail-line cut holds the OB and widens the CB rebound",
      "Visualize the CB's rebound point on the short rail before stroking",
    ],
    teaches:
      "Using inside english to recover position back to the center of the table.",
  },
  {
    id: "three-rail-middle",
    number: 4,
    name: "Three Rails to Middle",
    shortName: "3 Rails",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 3, y: 0.3 },
    objectBall: { x: 1.5, y: 0.3 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0, y: 2.5 },
      { x: 3, y: 4 },
      { x: 7, y: 2.5 },
      { x: 4, y: 3 },
    ],
    description:
      "Same rail-line setup as the stop shot, but send the cue ball three rails — short rail, far long rail, foot rail — and land it in the middle of the table.",
    technique:
      "Above-center with running english, firm pace. The english keeps the rebound angles open across all three rails.",
    commonMistakes: [
      "Not enough pace — CB dies before the third rail",
      "Wrong english kills one of the rebound angles",
      "Too thick a hit pulls the OB off line",
    ],
    tips: [
      "Pick the first-rail target diamond first, then work backward to the contact point",
      "Running english extends each rebound — calibrate it before adding pace",
    ],
    teaches:
      "Multi-rail position planning and how english stacks across three rails.",
  },
  {
    id: "two-rail-middle",
    number: 5,
    name: "Two Rails to Middle",
    shortName: "2 Rails",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 2, y: 2.5 },
    objectBall: { x: 1, y: 1 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0, y: 0.3 },
      { x: 2.2, y: 0 },
      { x: 4, y: 1.8 },
    ],
    description:
      "Pocket the OB in the corner and take two rails — short rail then long rail — back to the middle of the table. Pick a landing spot that stays off the scratch lines into either side pocket or the opposite corner.",
    technique:
      "Stun-follow with a touch of running english. Medium pace — enough to reach center after two rails without rolling past.",
    commonMistakes: [
      "Too much pace → CB grabs a third rail and drifts onto a scratch line",
      "Wrong english kills the second rebound and CB dies on the rail",
      "Landing on a line to the opposite corner or a side pocket",
    ],
    tips: [
      "Pick your final resting spot first, then work the second-rail target backward",
      "Stay off the scratch lines — center of table beats a pretty path that leaves you on a sell",
    ],
    teaches:
      "Two-rail position control with scratch-aware landing zones.",
  },
  {
    id: "draw-to-center",
    number: 6,
    name: "Draw to Center",
    shortName: "Draw Center",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 4, y: 1.8 },
    objectBall: { x: 2, y: 0.8 },
    targetPocket: "TR",
    cueBallPath: [{ x: 4, y: 1.8 }],
    description:
      "Cut the OB into the corner and draw the cue ball back to the center of the table — CB ends up exactly where it started.",
    technique:
      "One-third tip low, smooth stroke. Don't use too much low — just enough draw to bring the cue ball back to where it started.",
    commonMistakes: [
      "Too much low — CB pulls past center and lands on a scratch line",
      "Jacking the cue up → curve and miscue",
      "Decelerating at the ball → no draw at all",
    ],
    tips: [
      "Calibrate exactly the one-third-tip mark on your cue",
      "Pace matters as much as tip height — accelerate smoothly through",
    ],
    teaches:
      "Controlled draw distance — not maximum draw, but precise distance to a target.",
  },
  {
    id: "soft-english-across",
    number: 7,
    name: "Soft English Across",
    shortName: "Soft English",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 4, y: 1.5 },
    objectBall: { x: 1, y: 0.5 },
    targetPocket: "TR",
    cueBallPath: [{ x: 1, y: 3.5 }],
    description:
      "Variation of the draw-to-center shot. Cut the OB into the corner and float the cue ball straight across the table to the opposite long rail using just a whisper of english.",
    technique:
      "Very little english — no more than one-eighth of a tip. Soft stun pace; the english widens the tangent line just enough to send the CB cleanly across.",
    commonMistakes: [
      "Too much english — CB throws the OB or swerves off line",
      "Confusing this with the draw shot — this is a stun/float, not a draw",
    ],
    tips: [
      "Calibrate the 1/8-tip mark — most players use far too much spin here",
      "Soft, smooth stroke; the english does the work",
    ],
    teaches:
      "Minimal-english finesse — when a fraction of a tip is the right answer.",
  },
  {
    id: "two-rail-no-third",
    number: 8,
    name: "Two Rails — No Third",
    shortName: "2 Rails (No 3rd)",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 3, y: 2 },
    objectBall: { x: 1, y: 0.6 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0, y: 1.5 },
      { x: 1, y: 4 },
      { x: 1, y: 0.8 },
    ],
    description:
      "Pocket the OB in the corner; cue ball comes off the short rail, then the far long rail, and dies before it can pick up a third rail. Lands back near where the OB was.",
    technique:
      "Soft stun with a touch of inside english. Pace is the key — just enough to complete two rails without grabbing a third.",
    commonMistakes: [
      "Too much pace → CB picks up the third rail and lands wherever",
      "Wrong english changes both rebound angles",
    ],
    tips: [
      "Speed control matters more than english here — calibrate pace first",
      "Picture the dying point on the cloth before you stroke",
    ],
    teaches:
      "Speed control for stopping the cue ball on a specific rail count.",
  },
  {
    id: "four-rail-zig-zag",
    number: 9,
    name: "Four Rails — Zig-Zag",
    shortName: "4 Rails",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 2, y: 1.5 },
    objectBall: { x: 1, y: 0.5 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0, y: 2 },
      { x: 1.2, y: 4 },
      { x: 0, y: 2.5 },
      { x: 1.5, y: 0 },
      { x: 0.8, y: 1.5 },
    ],
    description:
      "Same setup as the two-rail version but with much more pace and english. CB zig-zags between the head rail and the two long rails for at least four rails. A fifth rail is fine.",
    technique:
      "Running english, firm pace. The english keeps the rebound angles open across every rail so the CB keeps traveling instead of dying.",
    commonMistakes: [
      "Not enough pace → CB stops at two or three rails",
      "Wrong english angle → CB exits the zig-zag pattern early",
    ],
    tips: [
      "Calibrate the english and pace together — both required for the chain",
      "If the fifth rail comes, that's fine — the goal is at least four",
    ],
    teaches:
      "Sustained zig-zag rebounds — feeling the english and pace required to keep the CB alive across many rails.",
  },
  {
    id: "long-follow",
    number: 10,
    name: "Long Follow Shot",
    shortName: "Long Follow",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Intermediate",
    cueBall: { x: 6, y: 2 },
    objectBall: { x: 2, y: 2 },
    targetPocket: "TR",
    cueBallPath: [{ x: 1, y: 1 }],
    description:
      "Long straight-in (or near-straight) shot up table where the cue ball must follow forward a controlled distance after pocketing.",
    technique:
      "High follow, smooth medium pace; cue ball picks up natural topspin.",
    commonMistakes: [
      "Stabbing the cue — loses forward roll",
      "Over-hitting and scratching the head rail",
    ],
    tips: [
      "Long, fluid follow-through",
      "About 1.5 tips above center for controlled follow distance",
    ],
    teaches: "Speed control with topspin over distance.",
  },
  {
    id: "long-draw",
    number: 11,
    name: "Long Draw Shot",
    shortName: "Long Draw",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Advanced",
    cueBall: { x: 6, y: 2 },
    objectBall: { x: 2, y: 2 },
    targetPocket: "TR",
    cueBallPath: [{ x: 7, y: 2.5 }],
    description:
      "Same alignment as the long follow — but the cue ball draws back a controlled distance after contact.",
    technique:
      "Low draw, level cue, smooth acceleration. Pace dictates draw distance.",
    commonMistakes: ["Jabbing → miscue", "Lifting the butt → curve and skid"],
    tips: [
      "Keep the cue as level as possible",
      "About 1.5 tips below center and let the stroke do the work",
    ],
    teaches:
      "Distance draw under control — the litmus test of stroke quality.",
  },
  {
    id: "around-the-table-follow",
    number: 12,
    name: "Around the Table — Follow",
    shortName: "Around (Follow)",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Advanced",
    cueBall: { x: 6, y: 1.5 },
    objectBall: { x: 6.5, y: 0.5 },
    targetPocket: "BR",
    cueBallPath: [
      { x: 8, y: 2 },
      { x: 6, y: 4 },
      { x: 2, y: 3 },
      { x: 4, y: 2 },
    ],
    description:
      "Cut the OB into the corner, then send the cue ball around three rails for position on a hypothetical next ball at center table.",
    technique:
      "Follow with a touch of running english; firm-medium pace.",
    commonMistakes: [
      "Wrong english kills the rebound angle",
      "Miscueing on the rail-jaw cut",
    ],
    tips: [
      "Pick the second-rail target diamond first, then work backward to the contact point",
      "Running english extends the path; reverse shortens it",
    ],
    teaches:
      "Multi-rail position planning and english effects on rebound angles.",
  },
  {
    id: "around-the-table-draw",
    number: 13,
    name: "Around the Table — Draw",
    shortName: "Around (Draw)",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Advanced",
    cueBall: { x: 2, y: 1.5 },
    objectBall: { x: 1, y: 0.5 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 4, y: 0 },
      { x: 7, y: 2 },
      { x: 5, y: 4 },
      { x: 4, y: 2 },
    ],
    description:
      "Mirror of the follow version. Cut the OB into the head corner, then draw the cue ball three rails for position.",
    technique:
      "Low draw plus running english, level cue, firm pace.",
    commonMistakes: [
      "Insufficient draw → only one or two rails",
      "Cue elevation causing curve",
    ],
    tips: [
      "Calibrate english separately from draw — practice each axis alone first",
      "Aim for a specific second-rail diamond as your target",
    ],
    teaches:
      "Reverse-direction multi-rail shape via draw plus english.",
  },
  {
    id: "rail-cut",
    number: 14,
    name: "Rail Cut Shot",
    shortName: "Rail Cut",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Intermediate",
    cueBall: { x: 3, y: 2 },
    objectBall: { x: 5.5, y: 0.2 },
    targetPocket: "BR",
    cueBallPath: [{ x: 4, y: 3 }],
    description:
      "Object ball frozen (or nearly) to the long rail; cue ball sits out in the table. Cut the OB down the rail into the corner.",
    technique:
      "Aim to hit OB and rail simultaneously; stun stroke; cue ball exits perpendicular.",
    commonMistakes: [
      "Aiming too thin → OB jaws",
      "Aiming too full → throw into the rail and out",
      "Inside english throwing the OB off the rail",
    ],
    tips: [
      "Aim the contact point at the inside edge of the OB's rail contact",
      "Outside english helps hold the OB on the rail",
    ],
    teaches:
      "Frozen-rail geometry and how english throws or holds the OB on the cushion.",
  },
  {
    id: "thin-side-cut",
    number: 15,
    name: "Thin Side-Pocket Cut",
    shortName: "Thin Side",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Intermediate",
    cueBall: { x: 2, y: 0.5 },
    objectBall: { x: 4, y: 1.7 },
    targetPocket: "ML",
    cueBallPath: [{ x: 5.5, y: 3.5 }],
    description:
      "Object ball near the side pocket with significant angle; cue ball up-table on the opposite side. Thin cut into the side.",
    technique:
      "Half-ball or thinner cut; speed control critical (sides are easy to scratch on).",
    commonMistakes: [
      "Scratching in the opposite side pocket",
      "Over-cutting due to perspective on the side",
    ],
    tips: [
      "Pick a precise contact point — side pockets are unforgiving",
      "A touch of outside english can widen the angle if needed",
    ],
    teaches: "Thin side-pocket cuts and scratch awareness.",
  },
  {
    id: "force-follow",
    number: 16,
    name: "Force-Follow Shot",
    shortName: "Force-Follow",
    series: "Shotmakers Workout · Vol. 18",
    difficulty: "Advanced",
    cueBall: { x: 6, y: 1 },
    objectBall: { x: 4, y: 1.5 },
    targetPocket: "TL",
    cueBallPath: [
      { x: 2, y: 3.5 },
      { x: 4, y: 2.5 },
    ],
    description:
      "Cut shot where the cue ball must continue strongly forward — overcoming the tangent — to reach position after multiple rails.",
    technique:
      "Max top, firm-to-hard pace, full follow-through. The topspin overrides the natural tangent line.",
    commonMistakes: [
      "Confusing it with stun-follow",
      "Decelerating and losing the force aspect",
    ],
    tips: [
      "Commit to the stroke speed",
      "Top tip plus acceleration — both are required",
    ],
    teaches:
      "When and how to override the tangent line through pure topspin and pace.",
  },
  {
    id: "wagon-wheel",
    number: 17,
    name: "Wagon Wheel Position",
    shortName: "Wagon Wheel",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Intermediate",
    cueBall: { x: 4, y: 2 },
    objectBall: { x: 6, y: 2 },
    targetPocket: "BR",
    cueBallPath: [{ x: 6, y: 2 }],
    description:
      "OB on the foot spot; CB at center. Six target zones around the table for the cue-ball landing. Cycle through follow, draw, stun — with and without english — to hit each zone.",
    technique:
      "Vary spin and speed to land the cue ball in each numbered target.",
    commonMistakes: [
      "Mixing axes (spin and follow) inconsistently",
      "Inconsistent speed across reps",
    ],
    tips: [
      "Do all six zones in order, every session",
      "Score yourself out of 6 — track progress",
    ],
    teaches:
      "Full vocabulary of cue-ball control off a single shot. The 'one shot, every position' principle.",
  },
  {
    id: "back-up-draw",
    number: 18,
    name: "Back-Up Draw Position",
    shortName: "Back-Up Draw",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Advanced",
    cueBall: { x: 5, y: 2 },
    objectBall: { x: 6.5, y: 1 },
    targetPocket: "BR",
    cueBallPath: [{ x: 2, y: 2 }],
    description:
      "Slight cut to the corner; cue ball must draw back across the table to land near the head rail for next-ball shape.",
    technique:
      "Smooth draw, no english needed, pace dictates distance.",
    commonMistakes: [
      "Not enough acceleration → CB stops mid-table",
      "Accidental english → CB curves off line",
    ],
    tips: [
      "Pause at the back of the stroke",
      "Imagine a 'target carpet' on the head end and land there",
    ],
    teaches:
      "Distance draw position — the 'go nowhere or go far' decision.",
  },
  {
    id: "one-rail-across",
    number: 19,
    name: "One-Rail Position",
    shortName: "One-Rail",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Intermediate",
    cueBall: { x: 3, y: 2 },
    objectBall: { x: 6, y: 2 },
    targetPocket: "BR",
    cueBallPath: [
      { x: 7, y: 0 },
      { x: 5, y: 2.5 },
    ],
    description:
      "Near-straight shot where the cue ball uses a single rail to land in a specific zone on the opposite side.",
    technique:
      "Stun-follow with a touch of english to widen or shorten the rebound.",
    commonMistakes: [
      "Misjudging rebound by ignoring english",
      "Double-railing from too much pace",
    ],
    tips: [
      "Use the mirror principle — angle in equals angle out",
      "Outside english extends, inside shortens",
    ],
    teaches:
      "Single-rail planning plus english tuning.",
  },
  {
    id: "two-rail-kick",
    number: 20,
    name: "Two-Rail Kick",
    shortName: "Two-Rail Kick",
    series: "Run Out 9-Ball · Vol. 3",
    difficulty: "Advanced",
    cueBall: { x: 4, y: 2 },
    objectBall: { x: 6, y: 3.5 },
    targetPocket: null,
    cueBallPath: [
      { x: 6.5, y: 4 },
      { x: 8, y: 2.5 },
      { x: 6, y: 3.5 },
    ],
    description:
      "Object ball hidden behind a blocker (implied). Cue ball must travel two rails to make legal contact with the OB.",
    technique:
      "Diamond-system kick; standardize on running english at medium pace and choose a target diamond off the second rail.",
    commonMistakes: [
      "Wrong english assumption",
      "Speed wrong — the angle changes with pace",
    ],
    tips: [
      "Use a kick system (Kinister demonstrates one on tape)",
      "Standardize on running english at medium pace as a baseline",
    ],
    teaches:
      "Systematic kicking — the difference between hoping and aiming.",
  },
  {
    id: "cross-side-bank",
    number: 21,
    name: "Cross-Side Bank",
    shortName: "Cross-Side Bank",
    series: "Bank Shot Workout",
    difficulty: "Intermediate",
    cueBall: { x: 4, y: 2 },
    objectBall: { x: 5, y: 3 },
    targetPocket: "ML",
    objectBallPath: [
      { x: 5.5, y: 0 },
      { x: 4, y: 4 },
    ],
    cueBallPath: [{ x: 5, y: 3 }],
    description:
      "Cross-table single-rail bank into the opposite side pocket.",
    technique:
      "Stun, dead-center; no english unless needed to compensate for cut-induced throw.",
    commonMistakes: [
      "Cut-bank throw making the OB land short",
      "Excess english changing OB rebound",
    ],
    tips: [
      "Mirror system for straight-in banks",
      "Aim slightly thicker than mirror to compensate for cut-induced throw",
    ],
    teaches: "Bank geometry plus cut-induced angle change.",
  },
  {
    id: "controlled-break",
    number: 22,
    name: "Controlled Break",
    shortName: "Controlled Break",
    series: "Secret 9-Ball Knowledge · Vol. 3",
    difficulty: "Foundational",
    cueBall: { x: 2, y: 1 },
    objectBall: { x: 6, y: 2 },
    targetPocket: null,
    cueBallPath: [{ x: 4.5, y: 2 }],
    description:
      "Standard 9-ball rack on the foot spot. Cue ball behind the head string, slightly off-center. Pocket a ball and leave the cue near center.",
    technique:
      "Square, full hit on the 1; controlled speed (not max). CB control beats raw power.",
    commonMistakes: [
      "Hitting too hard → loss of cue-ball control",
      "Off-center hit → cue ball flies around the table",
    ],
    tips: [
      "Aim for a controlled break — fewer rails, more accuracy",
      "Keep the cue level; ride the cue ball to a stop near center",
    ],
    teaches:
      "Repeatable break — pocket a ball plus leave the cue ball in playable position.",
  },
  {
    id: "jump-shot",
    number: 23,
    name: "Jump Shot Drill",
    shortName: "Jump Shot",
    series: "Jump Workout",
    difficulty: "Advanced",
    cueBall: { x: 4, y: 2 },
    objectBall: { x: 6, y: 2 },
    targetPocket: "BR",
    cueBallPath: [{ x: 6, y: 2 }],
    description:
      "Blocker placed halfway between cue ball and object ball. Cue ball must jump cleanly over it to reach the OB.",
    technique:
      "Cue elevated 45° or more, short stroke, hit down through the cue ball just above center.",
    commonMistakes: [
      "Scooping (illegal)",
      "Hitting too softly to clear the blocker",
      "Hitting the blocker first",
    ],
    tips: [
      "Use a jump cue or shorter break cue",
      "Hit hard and quick — let the cue ball rebound up off the cloth",
    ],
    teaches: "Legal jumping mechanics.",
  },
  {
    id: "combination",
    number: 24,
    name: "Combination Drill",
    shortName: "Combo",
    series: "Shotmakers Workout · Vol. 18",
    difficulty: "Intermediate",
    cueBall: { x: 3, y: 2 },
    objectBall: { x: 5, y: 2 },
    targetPocket: "BR",
    objectBallPath: [{ x: 6, y: 1.5 }],
    cueBallPath: [{ x: 5, y: 2 }],
    description:
      "Two object balls. The first must transfer the kiss into the second, which goes to the pocket.",
    technique:
      "Ghost-ball aiming on the second-to-first contact line; firm but not hard.",
    commonMistakes: [
      "Aiming the cue ball instead of the first OB's path",
      "Throwing the OB off line with english",
    ],
    tips: [
      "Find the first OB's contact point on the second; then aim the cue ball to put OB1 there",
      "Avoid english unless needed for cue-ball position",
    ],
    teaches: "Aiming through chains of contact.",
  },
  {
    id: "safety-hook",
    number: 25,
    name: "Safety / Hook Drill",
    shortName: "Safety",
    series: "The Middle Game · Vol. 36",
    difficulty: "Advanced",
    cueBall: { x: 2, y: 2 },
    objectBall: { x: 5, y: 2 },
    targetPocket: null,
    objectBallPath: [
      { x: 8, y: 2 },
      { x: 6, y: 2 },
    ],
    cueBallPath: [{ x: 3, y: 3.2 }],
    description:
      "Pure safety. Tap the OB just enough to send it to a rail and roll the cue ball behind a blocker for the snooker.",
    technique:
      "Very soft stroke, often with a touch of english to position the cue ball precisely.",
    commonMistakes: [
      "Over-hitting → OB returns to open position",
      "Failing the rail-contact requirement",
    ],
    tips: [
      "Picture the cue ball's final resting spot first; the OB hit is secondary",
      "On two-way shots, leave the OB ugly for the opponent too",
    ],
    teaches:
      "Defensive play — the half of pool most players ignore.",
  },
  {
    id: "one-handed",
    number: 26,
    name: "One-Handed Drill",
    shortName: "One-Handed",
    series: "Advanced Fundamentals",
    difficulty: "Advanced",
    cueBall: { x: 4, y: 2 },
    objectBall: { x: 6, y: 2 },
    targetPocket: "BR",
    cueBallPath: [{ x: 6, y: 2 }],
    description:
      "Straight-in shot, shot one-handed (no bridge). Cue held in the dominant hand only.",
    technique:
      "Compact, smooth stroke; rely on grip alignment.",
    commonMistakes: ["Death grip", "Steering the cue with the wrist"],
    tips: ["Loose grip", "Trust the alignment — don't try to steer"],
    teaches:
      "Pure stroke isolation — exposes any bridge-hand crutch.",
  },
  {
    id: "tight-pocket",
    number: 27,
    name: "Tight-Pocket Pocketing",
    shortName: "Tight Pocket",
    series: "Tight Pocket Workout",
    difficulty: "Intermediate",
    cueBall: { x: 2, y: 2 },
    objectBall: { x: 6, y: 2 },
    targetPocket: "BR",
    cueBallPath: [{ x: 6, y: 2 }],
    description:
      "Practice on a table with extra-tight pockets (or use coins to narrow the openings). Long straight-in.",
    technique:
      "Center-pocket aim; firm enough that the OB doesn't jaw; cue ball stops or controlled follow.",
    commonMistakes: [
      "Aiming at the pocket center instead of the OB contact point",
      "Soft hit → OB jaws",
    ],
    tips: [
      "Center-pocket aim is a result of perfect contact, not the goal itself",
      "Once it goes center on a tight pocket, it'll always go on a normal table",
    ],
    teaches:
      "Pocketing precision with no margin for error.",
  },
  {
    id: "ladder-drill",
    number: 28,
    name: "The Ladder Drill",
    shortName: "Ladder",
    series: "Kinister Drill Cycle",
    difficulty: "Foundational",
    cueBall: { x: 2, y: 2 },
    objectBall: { x: 3, y: 2 },
    targetPocket: "BR",
    cueBallPath: [{ x: 3, y: 2 }],
    description:
      "Place the OB one diamond in front of the cue ball. Pocket it stop-shot style. Move the OB back one diamond. Repeat until the OB is on the foot spot or beyond.",
    technique:
      "Pure stop shot every time; only the distance changes.",
    commonMistakes: [
      "Speed creep — hitting harder as distance grows",
      "Inconsistent tip strike when nervous near the end of the ladder",
    ],
    tips: [
      "Recalibrate stop-shot speed for every distance",
      "If you miss, restart from rung 1",
    ],
    teaches:
      "Stop-shot speed calibration across all distances. The ultimate stroke-honesty drill.",
  },
];

export function getShot(id: string): KinisterShot | undefined {
  return KINISTER_SHOTS.find((s) => s.id === id);
}
