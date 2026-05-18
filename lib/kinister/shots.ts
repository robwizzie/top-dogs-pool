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
    id: "replace-shot",
    number: 1,
    name: "The Replace Shot",
    shortName: "Replace",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Foundational",
    cueBall: { x: 6, y: 0.25 },
    objectBall: { x: 2, y: 0.25 },
    targetPocket: "TR",
    cueBallPath: [{ x: 2, y: 0.25 }],
    description:
      "Cue ball and object ball sit on the same long rail, each about a half-ball off the cushion, at opposite second diamonds. Pocket the OB in the far corner and roll the cue ball forward so it stops exactly where the OB started.",
    technique:
      "Soft-to-medium follow, dead center on the horizontal, slightly above center vertically. This is not a stop shot — the cue ball must roll forward and replace.",
    commonMistakes: [
      "Hitting too hard and rolling past the replacement spot",
      "Drifting off the rail line from unintended side spin",
      "Treating it like a stop shot instead of a follow",
    ],
    tips: [
      "Pick the exact replacement spot as your target before you stroke",
      "Stroke straight through — any side spin shows immediately on a path that hugs the cushion",
    ],
    teaches:
      "Perfectly straight cueing, controlled forward roll, and speed touch. Kinister called it the most important shot in pool because it exposes every stroke flaw.",
  },
  {
    id: "diagonal-draw",
    number: 2,
    name: "Diagonal Draw",
    shortName: "Diagonal Draw",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Intermediate",
    cueBall: { x: 6, y: 1 },
    objectBall: { x: 2, y: 1 },
    targetPocket: "TL",
    cueBallPath: [{ x: 6, y: 1 }],
    description:
      "OB sits up near the head corner; CB sits near the diagonally opposite foot corner. Shoot the OB the length of the table into the head corner and draw the cue ball all the way back to the starting CB area.",
    technique:
      "Strong low draw, level cue, full follow-through. A square hit on the object ball is critical at this distance.",
    commonMistakes: [
      "Jacking the butt up and miscueing",
      "Throwing the OB off line with unintended english",
      "Not enough draw — the cue ball stalls mid-table",
    ],
    tips: [
      "Keep the cue as level as possible and accelerate smoothly",
      "Aim for the OB first — don't try to 'help' the draw with body english",
    ],
    teaches:
      "Long draw under pressure. A true stroke check on a 9-foot table.",
  },
  {
    id: "mighty-x",
    number: 3,
    name: "The Mighty X",
    shortName: "Mighty X",
    series: "Vol. 12 · The Mighty X",
    difficulty: "Foundational",
    cueBall: { x: 6, y: 1 },
    objectBall: { x: 2, y: 3 },
    targetPocket: "TL",
    cueBallPath: [{ x: 4, y: 2 }],
    description:
      "Place CB and OB on the long diagonal — OB near one corner, CB near the diagonally opposite corner. Shoot straight in. Variants include stop, replace, follow, or draw back to the center spot.",
    technique:
      "Identical pre-shot routine every rep. One practice stroke (or none). Focus on the tip's arrival point at the cue ball, not the OB.",
    commonMistakes: [
      "Excessive practice strokes that erode commitment",
      "Body movement during the stroke",
      "Inconsistent address each rep",
    ],
    tips: [
      "Use the same pre-shot routine every time",
      "Lock vision center on the contact point before pulling the trigger",
    ],
    teaches:
      "The 'address' — body alignment, vision center, level cue, straight stroke. Kinister's signature stance and stroke trainer.",
  },
  {
    id: "long-stop-shot",
    number: 4,
    name: "Long Straight-In Stop Shot",
    shortName: "Long Stop",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Foundational",
    cueBall: { x: 2, y: 2 },
    objectBall: { x: 6, y: 2 },
    targetPocket: "BR",
    cueBallPath: [{ x: 6, y: 2 }],
    description:
      "Cue ball on the head spot, object ball on the foot spot, shot down into a foot-corner pocket. The cue ball must freeze at the moment of contact.",
    technique:
      "Center-ball, medium-firm speed, perfect contact point. Cue ball stops dead on impact.",
    commonMistakes: [
      "Hitting too soft — the cue ball rolls forward",
      "Unintended draw — the cue ball pulls back",
      "Adding body english on a long shot",
    ],
    tips: [
      "Pace = enough to send the OB to the pocket plus half a table",
      "Watch the tip strike point, not the OB after the stroke",
    ],
    teaches:
      "Center-ball contact and speed calibration over distance — the bedrock of all position play.",
  },
  {
    id: "spot-shot",
    number: 5,
    name: "Spot Shot",
    shortName: "Spot Shot",
    series: "60 Minute Workout · Vol. 1",
    difficulty: "Intermediate",
    cueBall: { x: 2, y: 0.5 },
    objectBall: { x: 6, y: 2 },
    targetPocket: "BL",
    cueBallPath: [{ x: 4, y: 2 }],
    description:
      "Classic spot shot: object ball on the foot spot, cue ball just behind the head string near one side rail. Cut the OB to the opposite far corner.",
    technique:
      "Half-ball hit; can be played as a stun (90° tangent), with running english, or as a stop-shot variant.",
    commonMistakes: [
      "Over-cutting from poor sighting at distance",
      "Scratching in the side or opposite corner",
      "Adding english that throws the object ball",
    ],
    tips: [
      "Lock in the contact point first, then aim the cue ball to that point",
      "Choose a tangent line that avoids scratches",
    ],
    teaches:
      "Cut-shot fundamentals at distance plus safe-zone cue-ball control. A universal pool benchmark.",
  },
  {
    id: "stun-side-cut",
    number: 6,
    name: "Stun Side-Pocket Cut",
    shortName: "Stun Cut",
    series: "Shotmakers Workout · Vol. 18",
    difficulty: "Intermediate",
    cueBall: { x: 5, y: 1 },
    objectBall: { x: 4.2, y: 1.5 },
    targetPocket: "ML",
    cueBallPath: [{ x: 6.5, y: 3 }],
    description:
      "Object ball just off the side pocket; cue ball cuts it in so the tangent line carries the cue ball cleanly across the table.",
    technique:
      "Stun — just above center to neutralize natural roll. Cue ball must depart along the 90° tangent.",
    commonMistakes: [
      "Letting the cue ball roll, which kills the tangent path",
      "Aiming the OB to the pocket without planning the cue-ball tangent",
    ],
    tips: [
      "Visualize the tangent line before the stroke",
      "Calibrate the exact tip height that kills roll at that distance",
    ],
    teaches:
      "Tangent-line discipline and stun cueing — the gateway to safe position play.",
  },
  {
    id: "stun-follow",
    number: 7,
    name: "Stun-Follow",
    shortName: "Stun-Follow",
    series: "Shotmakers Workout · Vol. 18",
    difficulty: "Advanced",
    cueBall: { x: 4, y: 1 },
    objectBall: { x: 6, y: 2 },
    targetPocket: "BR",
    cueBallPath: [
      { x: 5, y: 3 },
      { x: 6.5, y: 3.5 },
    ],
    description:
      "Cut shot to the corner where the cue ball goes along the tangent first, then curls forward to get position.",
    technique:
      "Slightly above center with a firm stroke — enough topspin to re-engage after the tangent leg.",
    commonMistakes: [
      "Hitting too high → full follow, no tangent",
      "Hitting center → pure stun, no forward bend",
    ],
    tips: [
      "Practice the narrow tip-height window between center and follow",
      "Harder pace lengthens the tangent leg before the forward curl",
    ],
    teaches:
      "Refined cue-ball control for routes that pure follow or pure stun can't reach.",
  },
  {
    id: "stun-draw",
    number: 8,
    name: "Stun-Draw",
    shortName: "Stun-Draw",
    series: "Shotmakers Workout · Vol. 18",
    difficulty: "Advanced",
    cueBall: { x: 4, y: 1 },
    objectBall: { x: 6, y: 2 },
    targetPocket: "BR",
    cueBallPath: [
      { x: 5, y: 3 },
      { x: 3.5, y: 2.5 },
    ],
    description:
      "Same shape as stun-follow, but the cue ball travels the tangent first, then bends backward.",
    technique:
      "Slightly below center, firm stroke. Just enough draw that it kicks in after the tangent leg.",
    commonMistakes: [
      "Going too low → full draw immediately, no tangent leg",
      "Decelerating → no draw at all",
    ],
    tips: [
      "Accelerate through the ball",
      "Pace and tip height together control how far the cue ball travels before bending",
    ],
    teaches:
      "Three-dimensional cue-ball shape — tangent for distance, draw for the bend back.",
  },
  {
    id: "long-follow",
    number: 9,
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
    number: 10,
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
    number: 11,
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
    number: 12,
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
    number: 13,
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
    number: 14,
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
    number: 15,
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
    number: 16,
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
    number: 17,
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
    number: 18,
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
    number: 19,
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
    number: 20,
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
    number: 21,
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
    number: 22,
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
    number: 23,
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
    number: 24,
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
    number: 25,
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
    number: 26,
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
    number: 27,
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
