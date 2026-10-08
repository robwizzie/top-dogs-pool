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
 *
 * Every single-ball shot is checked against the physics engine
 * (./physics.ts): `power` + `english` are "Bert's setup", and `cueBallPath`
 * is where the simulated cue ball actually goes with them (rail contacts,
 * then the resting spot). If you move a ball, re-tune `power`/`english`
 * and the path together — `npm run test:kinister` fails when the diagram
 * and the simulation disagree.
 */

export type DiamondCoord = { x: number; y: number };
export type PocketId = "TL" | "TR" | "BL" | "BR" | "ML" | "MR";

/**
 * Where to strike the cue ball to apply the english/spin the shot needs.
 * `x` is horizontal: -1 = full left english, 0 = center, +1 = full right.
 * `y` is vertical: -1 = full draw (low), 0 = center, +1 = full follow (high).
 */
export type EnglishHit = { x: number; y: number };

export const POCKETS: Record<PocketId, DiamondCoord> = {
  TR: { x: 0, y: 0 },
  TL: { x: 0, y: 4 },
  BR: { x: 8, y: 0 },
  BL: { x: 8, y: 4 },
  MR: { x: 4, y: 0 },
  ML: { x: 4, y: 4 },
};

export type Difficulty = "Foundational" | "Intermediate" | "Advanced";

/**
 * One step of a multi-ball drill (e.g. run-six-balls). Each step pockets a
 * single ball and lands the cue ball in `cueAfter` for the next step.
 */
export type DrillStep = {
  ball: DiamondCoord;
  pocket: PocketId;
  /** Where the cue ball rests after pocketing this ball. */
  cueAfter: DiamondCoord;
};

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
  /** Where to strike the cue ball to make this shot work (english/spin). */
  english?: EnglishHit;
  /**
   * Stroke power for the physics simulation, 0..1 (see
   * `powerToSpeed` in ./physics). Calibrated so the simulated cue ball
   * follows `cueBallPath` with `english` — i.e. "how Bert plays it".
   */
  power?: number;
  /**
   * Optional "what goes wrong" mini-diagrams. Each entry pairs a verbal
   * description of the mistake with an alternate cue-ball path that
   * illustrates the bad outcome. Rendered alongside Common Mistakes on
   * the shot detail page.
   */
  mistakeDiagrams?: Array<{
    /** Headline: the player's error. */
    mistake: string;
    /** What happens to the cue ball as a result. */
    outcome: string;
    /** Alternate post-contact cue-ball path. Same coord system as cueBallPath. */
    cueBallPath: DiamondCoord[];
  }>;
  /** Optional object-ball waypoints (e.g. banks). If omitted, OB rolls to targetPocket. */
  objectBallPath?: DiamondCoord[];
  /** Additional balls on the table for context (multi-ball drills). Rendered statically — they don't move with the animation. */
  otherBalls?: DiamondCoord[];
  /** Ordered pocketing sequence for multi-ball drills. When present, the diagram numbers each ball and draws the full run-out. */
  sequence?: DrillStep[];
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
const SHOT_VIDEO_OVERRIDES: Record<string, keyof typeof KINISTER_VIDEOS> = {};

/**
 * Per-shot YouTube start times (seconds). The embed and "Watch on YouTube"
 * link both jump to this mark.
 *
 * To add one: watch the source video, note the moment the shot is set up
 * (or first demonstrated), and add `"<shot-id>": <seconds>` below. IDs
 * match `KinisterShot.id` (e.g. "replace-shot", "mighty-x"). Convert
 * mm:ss → seconds (e.g. 1:23 → 83).
 */
const SHOT_START_SECONDS: Record<string, number> = {
  // "replace-shot": 32,
  // "diagonal-draw": 195,
  // ...
};

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
    name: "Replace the Object Ball",
    shortName: "Replace OB",
    series: "Top Dogs Workout",
    difficulty: "Foundational",
    cueBall: { x: 6, y: 0.75 },
    objectBall: { x: 2, y: 0.28 },
    targetPocket: "TR",
    cueBallPath: [{ x: 1.98, y: 0.31 }],
    english: { x: 0, y: -0.2 },
    power: 0.31,
    mistakeDiagrams: [
      {
        mistake: "Hitting above center",
        outcome:
          "Cue ball rolls through the OB's spot and keeps following toward the corner instead of stopping on it.",
        cueBallPath: [{ x: 1.46, y: 0.28 }],
      },
      {
        mistake: "Too much low / decelerating",
        outcome:
          "Cue ball stops short of the OB's spot — and at this pace the draw also bleeds off the OB's speed so it can die before the pocket.",
        cueBallPath: [{ x: 2.22, y: 0.32 }],
      },
    ],
    description:
      "Bert's shot #1. Object ball at the second diamond, about half a ball off the long rail; cue ball back at the other second diamond on the same rail. Pocket the OB in the corner and have the cue ball roll forward and take the OB's place — it is NOT a stop shot.",
    technique:
      "A hair below center, slow-medium pace. Over four diamonds the cloth turns that into a slight stun-follow at contact, so the cue ball creeps one ball-width forward onto the OB's spot.",
    commonMistakes: [
      "Hitting it as a stop shot → CB stops a ball short of the OB spot",
      "Hitting above center → CB rolls through the OB spot toward the pocket",
      "Adding english that walks the CB off the rail line",
    ],
    tips: [
      "Pick the OB's spot as your CB resting target before you stroke",
      "Bert uses this as his stroke check — if the CB doesn't replace the OB, the stroke isn't straight",
    ],
    teaches:
      "Speed and tip-height feel — how far the cue ball rolls after contact at a given distance. The bedrock of every position play.",
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
    cueBallPath: [{ x: 1.53, y: 0.46 }],
    english: { x: 0, y: 0 },
    power: 0.355,
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
    objectBall: { x: 3, y: 1.5 },
    targetPocket: "TR",
    cueBallPath: [{ x: 6.88, y: 3.44 }],
    english: { x: 0, y: -0.6 },
    power: 0.76,
    description:
      "Cue ball near the foot-end corner; OB sits on the long diagonal, straight in to the far corner. Pocket the OB and draw the cue ball all the way back down the diagonal to where it started.",
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
    name: "Left English — Return to Center",
    shortName: "Left English",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 3, y: 0.3 },
    objectBall: { x: 0.4, y: 0.3 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0.14, y: 0.9 },
      { x: 1.84, y: 3.86 },
      { x: 4.01, y: 2.02 },
    ],
    english: { x: -0.45, y: 0 },
    power: 0.49,
    description:
      "Rail-line cut into the corner with left english. After pocketing the OB the cue ball comes off the short rail just below the pocket, crosses to the far long rail, and floats back to land in the dead center of the table.",
    technique:
      "Half a tip of left english, center height, medium pace. On this cut left is outside (running) english: it widens the rebound off the short rail so the cue ball swings back across to the center spot.",
    commonMistakes: [
      "Too much english — squirt and throw pull the OB off the rail line",
      "Right english instead — reverse spin shortens the short-rail rebound and the CB never reaches the far rail",
      "Hitting too hard and over-running the landing zone",
    ],
    tips: [
      "Running english off the short rail is what turns the CB back toward center",
      "Visualize the CB's rebound point on the short rail before stroking",
    ],
    teaches:
      "Using inside english to recover position into the dead center of the table after a rail-line shot.",
  },
  {
    id: "three-rail-middle",
    number: 4,
    name: "Three Rails to Middle",
    shortName: "3 Rails",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 3, y: 2.3 },
    objectBall: { x: 1.2, y: 0.6 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 1.63, y: 0.14 },
      { x: 0.14, y: 1.77 },
      { x: 1.24, y: 3.86 },
      { x: 3.05, y: 2.31 },
    ],
    english: { x: -0.55, y: 0.5 },
    power: 0.745,
    description:
      "Cue ball starts in the middle of the table; OB sits up by the corner pocket. Cut the OB into the corner and send the cue ball three rails — near long rail, short rail, far long rail — back to the middle of the table where it started, ready for the next ball.",
    technique:
      "High left (running) english, firm pace. The english keeps each rebound angle open so the cue ball wraps cleanly back to the middle.",
    commonMistakes: [
      "Not enough pace — CB dies before completing the wrap",
      "Wrong english kills one of the rebound angles",
      "Too thick a hit pulls the OB off the corner line",
    ],
    tips: [
      "Pick the first-rail target diamond first, then work backward to the contact point",
      "Running english extends each rebound — calibrate it before adding pace",
    ],
    teaches:
      "Multi-rail position planning — sending the CB the long way around and landing it back where you started.",
  },
  {
    id: "two-rail-middle",
    number: 5,
    name: "Two Rails to Middle",
    shortName: "2 Rails",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 1.2, y: 3 },
    objectBall: { x: 0.4, y: 1.5 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0.14, y: 1.78 },
      { x: 1.19, y: 0.14 },
      { x: 2.95, y: 2.24 },
    ],
    english: { x: 0.25, y: 0.5 },
    power: 0.63,
    description:
      "OB sits on the head rail between TR and the head spot; CB starts back near the head-rail/left-rail corner area. Cut the OB into the corner and take two rails — head rail, then the near long rail — to land in the open upper-middle of the table. Pick a landing spot that stays off the scratch lines into either side pocket or the opposite corner.",
    technique:
      "Follow with a touch of right (running) english, medium pace — enough to reach the upper-middle landing zone without rolling past it onto a scratch line. Keep the stroke smooth; jamming high-right english sends the CB off the first rail at a false angle.",
    commonMistakes: [
      "Too much pace → CB grabs a third rail and drifts onto a scratch line",
      "Wrong english kills the second rebound and CB dies on the rail",
      "Landing on a line to the opposite corner or a side pocket",
    ],
    tips: [
      "Pick your final resting spot first, then work the second-rail target backward",
      "Stay off the scratch lines — open middle beats a pretty path that leaves you on a sell",
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
    cueBall: { x: 3.6, y: 1.8 },
    objectBall: { x: 2, y: 1 },
    targetPocket: "TR",
    cueBallPath: [{ x: 3.63, y: 1.82 }],
    english: { x: 0, y: -0.5 },
    power: 0.64,
    description:
      "OB sits two diamonds out from the corner pocket; the cue ball is straight in behind it, in the open middle of the table. Pocket the OB and draw the cue ball straight back along the same line to land right where it started.",
    technique:
      "One-third tip low, smooth stroke. Don't use too much low — just enough draw to bring the cue ball back to where it started.",
    commonMistakes: [
      "Too much low — CB pulls past the start spot and lands on a scratch line",
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
    cueBall: { x: 3, y: 0.75 },
    objectBall: { x: 2, y: 1 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 1.13, y: 3.86 },
      { x: 0.88, y: 3.49 },
    ],
    english: { x: 0.12, y: -0.8 },
    power: 0.385,
    description:
      "Variation of the draw-to-center shot — same OB, but the cue ball now sits up near the head end so it's a cut. Pocket the OB and float the cue ball down the tangent line straight across the table — it nicks the far long rail and dies right next to it.",
    technique:
      "Low enough that the cue ball arrives stunned (no roll), soft pace, and only a whisper of right english — no more than one-eighth of a tip. The stun sends the CB down the tangent line; the english just tunes where it nicks the rail.",
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
    cueBall: { x: 2.4, y: 1.2 },
    objectBall: { x: 0.6, y: 0.5 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0.14, y: 1.6 },
      { x: 0.79, y: 3.86 },
      { x: 0.89, y: 2.59 },
    ],
    english: { x: 0.3, y: -0.4 },
    power: 0.685,
    mistakeDiagrams: [
      {
        mistake: "Too much pace",
        outcome:
          "Cue ball doesn't die after the far rail — it runs on down the table and can scratch in the far corner.",
        cueBallPath: [
          { x: 0.14, y: 1.45 },
          { x: 2.44, y: 3.86 },
          { x: 8, y: 0 },
        ],
      },
    ],
    description:
      "Pocket the OB in the corner; the cue ball comes off the short rail, then the far long rail, and dies before it can pick up a third rail — up-table of the head string, in the middle of the table.",
    technique:
      "A little below center with a touch of inside (right) english, medium pace. Pace is the key — just enough to complete two rails without grabbing a third.",
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
    name: "Four Rails — Around the Table",
    shortName: "4 Rails",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 2.4, y: 1.2 },
    objectBall: { x: 0.6, y: 0.5 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0.14, y: 1.43 },
      { x: 3.02, y: 3.86 },
      { x: 7.86, y: 1.35 },
      { x: 5.33, y: 0.14 },
      { x: 2.51, y: 0.99 },
    ],
    english: { x: 0.5, y: -0.8 },
    power: 0.95,
    mistakeDiagrams: [
      {
        mistake: "Not enough pace",
        outcome:
          "Cue ball stops after two rails instead of making it all the way around the table.",
        cueBallPath: [
          { x: 0.14, y: 1.66 },
          { x: 1.46, y: 3.86 },
          { x: 3.55, y: 0.85 },
        ],
      },
    ],
    description:
      "Same setup as the two-rail version but with much more pace and spin. The cue ball goes short rail, far long rail, foot rail, near long rail — all the way around the table and back up toward the head end. A fifth rail is fine.",
    technique:
      "Power stroke with low right english. The draw carries the CB wide off the first rail and the pace keeps it alive for four rails.",
    commonMistakes: [
      "Not enough pace → CB stops after two or three rails",
      "Wrong english angle → CB comes off the foot rail into a corner pocket",
    ],
    tips: [
      "Calibrate the english and pace together — both required for the chain",
      "If the fifth rail comes, that's fine — the goal is at least four",
    ],
    teaches:
      "Sustained zig-zag rebounds — feeling the english and pace required to keep the CB alive across many rails.",
  },
  {
    id: "half-table-draw",
    number: 10,
    name: "Half-Table Draw",
    shortName: "Half Draw",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 4, y: 1.6 },
    objectBall: { x: 1, y: 0.4 },
    targetPocket: "TR",
    cueBallPath: [{ x: 4.12, y: 1.65 }],
    english: { x: 0, y: -0.7 },
    power: 0.655,
    description:
      "Mid-distance draw shot. Pocket the OB in the corner and draw the cue ball back exactly half a table to its starting position.",
    technique:
      "Low draw, level cue, smooth pace. Less power than the full-length version — calibrated for half-table distance.",
    commonMistakes: [
      "Too much pace → CB blows past the start spot",
      "Decelerating → draw dies short",
      "Cue elevation → curve",
    ],
    tips: [
      "Pick your exact resting target before the stroke",
      "Pace dictates draw distance — keep tip height consistent",
    ],
    teaches:
      "Calibrated draw distance — not maximum, not minimum, a specific target.",
  },
  {
    id: "side-pocket-six-pack",
    number: 11,
    name: "Six Balls into the Side",
    shortName: "Side 6-Pack",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 4, y: 2 },
    objectBall: { x: 4, y: 0.5 },
    targetPocket: "MR",
    cueBallPath: [{ x: 4, y: 2.04 }],
    english: { x: 0, y: -0.6 },
    power: 0.555,
    description:
      "Run six object balls one at a time into the side pocket. Each one is straight in from the center of the table, and after each ball the cue ball must draw back to the center spot for the next setup.",
    technique:
      "Draw — a bit more than a tip below center — with a smooth medium stroke. Same stroke every rep so the cue ball comes back to the same spot.",
    commonMistakes: [
      "Over-hitting → CB draws past center",
      "Unintended side spin → CB drifts off the line and the next ball isn't straight",
      "Treating each ball differently — the goal is repeatability",
    ],
    tips: [
      "Find the pace and tip height that consistently returns to center, then repeat it",
      "Score the drill — out of six — and track progress across sessions",
    ],
    teaches:
      "Repeatable side-pocket pocketing with consistent CB position. The drill that builds break-and-run discipline.",
  },
  {
    id: "right-english-to-center",
    number: 12,
    name: "Right English to Center",
    shortName: "Right English",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 3, y: 1.8 },
    objectBall: { x: 1, y: 1.2 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0.14, y: 1.88 },
      { x: 4.02, y: 2.26 },
    ],
    english: { x: 0.55, y: 0.2 },
    power: 0.49,
    description:
      "Cut the OB into the corner using a half-tip of right english; the cue ball comes off the short rail and back out to the middle of the table.",
    technique:
      "Half cuetip of right english, smooth medium pace. The english widens the rebound just enough to swing back to center.",
    commonMistakes: [
      "Too much english → CB swings past center or throws the OB",
      "No english → CB stays near the rail line instead of returning",
    ],
    tips: [
      "Calibrate exactly the half-tip mark on your tip — it's the right english amount for most position shots like this",
      "Pace matters as much as english — they tune the rebound angle together",
    ],
    teaches:
      "Using a precise english amount (½ tip) to dial the cue ball into center of table.",
  },
  {
    id: "three-rail-deflection",
    number: 13,
    name: "Three Rails — High Left English",
    shortName: "3 Rails (Deflection)",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 3, y: 2.6 },
    objectBall: { x: 1.4, y: 0.9 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 1.98, y: 0.14 },
      { x: 0.14, y: 2.58 },
      { x: 0.63, y: 3.86 },
      { x: 3.01, y: 2.01 },
    ],
    english: { x: -0.5, y: 0.4 },
    power: 0.845,
    description:
      "Three rails back to the center of the table with high-left english. Use this shot to dial in how much cue deflection (squirt) you get on your stick.",
    technique:
      "High left english, firm-medium pace. The combination of follow plus side spin and pace together cause deflection — aim slightly to compensate.",
    commonMistakes: [
      "Aiming at the contact point without compensating for deflection",
      "Letting english slip during the stroke → inconsistent rebound",
    ],
    tips: [
      "Test the deflection on your cue first — every shaft squirts differently",
      "High english plus running side keeps the CB alive across all three rails",
    ],
    teaches:
      "Cue deflection awareness and how high+side english combine across multiple rails.",
  },
  {
    id: "natural-angle-to-center",
    number: 14,
    name: "Natural Angle to Center",
    shortName: "Natural Center",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 3, y: 0.5 },
    objectBall: { x: 1, y: 0.5 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0.14, y: 1.73 },
      { x: 1.75, y: 3.86 },
      { x: 3.99, y: 2.22 },
    ],
    english: { x: 0, y: 0.3 },
    power: 0.555,
    description:
      "Rail-line cut into the corner; the cue ball takes the natural angle off the short rail and the far long rail and lands in the center of the table.",
    technique:
      "Center-ball or a touch of follow, medium pace. No forced english — let the natural mirror rebound do the work.",
    commonMistakes: [
      "Adding english that distorts the natural rebound",
      "Too much pace → CB sails past center",
    ],
    tips: [
      "Trust the mirror principle — angle in equals angle out at this pace",
      "Soft, smooth stroke; the table does the work",
    ],
    teaches:
      "Reading natural rebound angles without relying on english.",
  },
  {
    id: "pats-favorite",
    number: 15,
    name: "Pat's Favorite",
    shortName: "Pat's Favorite",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 2.3, y: 1.2 },
    objectBall: { x: 1, y: 0.9 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0.14, y: 1.73 },
      { x: 1.44, y: 3.86 },
      { x: 3.95, y: 1.96 },
    ],
    english: { x: -0.75, y: 0.3 },
    power: 0.45,
    description:
      "Pat's go-to shape shot. Pocket the OB in the corner from a near-straight angle and send the cue ball off the short rail near the pocket and the far long rail to land in the dead center of the table.",
    technique:
      "Running english, medium pace. Two rails wrap the CB across to the center of the table for shape on the next ball.",
    commonMistakes: [
      "Wrong english → second rail rebound dies short",
      "Too much pace → CB grabs a third rail and overshoots",
    ],
    tips: [
      "Pick the center-of-table landing spot before stroking",
      "Running english is the constant — pace dictates landing distance",
    ],
    teaches:
      "Two-rail wrap shape — the bread-and-butter position route Pat uses to land in the center of the table for the next ball.",
  },
  {
    id: "two-rails-top-middle",
    number: 16,
    name: "Two Rails — Middle of Top Table",
    shortName: "2 Rails (Top)",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 5, y: 0.45 },
    objectBall: { x: 2, y: 0.6 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0.87, y: 3.86 },
      { x: 0.14, y: 3.37 },
      { x: 1.2, y: 1.83 },
    ],
    english: { x: 0.4, y: -0.25 },
    power: 0.64,
    description:
      "Cut the OB into the corner and bring the cue ball back two rails — far long rail, then short rail — to land in the middle of the top (head) end of the table.",
    technique:
      "Stun with running english, medium pace. The two-rail loop drops the CB into the upper-middle zone for the next shot.",
    commonMistakes: [
      "Pace wrong → CB lands at the wrong end of the head area",
      "English wrong → second rebound shoots into a corner",
    ],
    tips: [
      "Picture the head-end landing zone as a small carpet — aim to land on it",
      "Running english keeps both rebounds open",
    ],
    teaches:
      "Two-rail control landing specifically in the head end of the table.",
  },
  {
    id: "speed-control-no-rails",
    number: 17,
    name: "Speed Control — No Long Rails",
    shortName: "Speed Control",
    series: "Top Dogs Workout",
    difficulty: "Foundational",
    cueBall: { x: 2.2, y: 1.6 },
    objectBall: { x: 0.3, y: 1 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0.14, y: 1.32 },
      { x: 5.25, y: 2.43 },
    ],
    english: { x: 0, y: 0.3 },
    power: 0.425,
    description:
      "Thin cut on an OB near the short rail; the cue ball comes off the short rail and rolls back down-table, stopping without ever touching a long rail. Pure speed control drill.",
    technique:
      "Soft follow, no side. Don't use the long rails — the only variable that matters is pace.",
    commonMistakes: [
      "Touching a long rail — disqualifies the rep",
      "Hitting too hard and reaching the foot rail",
      "Adding unintended english that drifts CB into a rail",
    ],
    tips: [
      "Pick the exact resting spot down-table before stroking",
      "Same stroke, every rep — only pace changes",
    ],
    teaches:
      "Pure speed calibration without rail help. Exposes any english creep in your stroke.",
  },
  {
    id: "three-rail-draw",
    number: 18,
    name: "Three-Rail Draw",
    shortName: "3 Rail Draw",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 2.5, y: 0.6 },
    objectBall: { x: 1, y: 0.8 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 0.14, y: 2.18 },
      { x: 0.89, y: 3.86 },
      { x: 5.11, y: 0.14 },
      { x: 5.81, y: 0.48 },
    ],
    english: { x: -0.4, y: -0.4 },
    power: 0.545,
    description:
      "Pocket the OB in the corner with draw and send the cue ball three rails — short, far long, near long — ending down by the foot end of the right rail.",
    technique:
      "Low draw plus running english, firm pace. The draw spin drives the multi-rail path.",
    commonMistakes: [
      "Not enough draw → CB stops at one or two rails",
      "Wrong english angle → CB pattern collapses",
      "Cue elevation → curve",
    ],
    tips: [
      "Pick the third-rail target diamond first, then work backward",
      "Draw and english are both required — calibrate each axis alone first",
    ],
    teaches:
      "Three-rail draw shape — sustained pattern across the full table.",
  },
  {
    id: "side-pocket-cut-to-top",
    number: 19,
    name: "Side Pocket Cut — CB to Top",
    shortName: "Side to Top",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 3.3, y: 2.4 },
    objectBall: { x: 3.7, y: 0.5 },
    targetPocket: "MR",
    cueBallPath: [
      { x: 3.19, y: 0.14 },
      { x: 1.84, y: 2.26 },
    ],
    english: { x: 0, y: 0.3 },
    power: 0.51,
    description:
      "Slight cut into the side pocket. After contact the cue ball nips the near long rail just up-table of the pocket and floats diagonally back to the upper middle of the table.",
    technique:
      "Stun with a touch of follow; medium pace. The tangent walks the CB into a clean rail-and-out for upper-middle shape.",
    commonMistakes: [
      "Scratching in the opposite side pocket",
      "Too hard → CB picks up extra rails",
      "Adding english that throws the OB off line into the side",
    ],
    tips: [
      "Pick the precise contact point — side pockets are unforgiving",
      "Soft, smooth stroke; let the tangent line do the work",
    ],
    teaches:
      "Side-pocket cut paired with single-rail tangent shape into the upper middle.",
  },
  {
    id: "three-rail-high-english",
    number: 20,
    name: "Three Rails — ¾ High English",
    shortName: "3 Rails (High)",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 2, y: 2.2 },
    objectBall: { x: 1, y: 0.7 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 1.64, y: 0.13 },
      { x: 6.19, y: 3.86 },
      { x: 7.86, y: 3.13 },
      { x: 7.19, y: 2.96 },
    ],
    english: { x: 0.7, y: 0.7 },
    power: 0.815,
    description:
      "Pocket the OB in the corner from the head end, then send the cue ball three rails diagonally across the table to land near the opposite corner.",
    technique:
      "Three-quarters tip of high (top) english, firm pace. The combined topspin and running side keep all three rebounds open.",
    commonMistakes: [
      "Not enough english → CB dies on the second rail",
      "Too much pace → CB grabs a fourth rail",
    ],
    tips: [
      "Calibrate the ¾-tip mark on your tip",
      "Pace and english together — they tune the path",
    ],
    teaches:
      "High english with pace for a long three-rail diagonal pattern.",
  },
  {
    id: "outside-english-draw",
    number: 21,
    name: "Outside English + Draw",
    shortName: "Outside Draw",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 2.74, y: 2.07 },
    objectBall: { x: 1.2, y: 1 },
    targetPocket: "TR",
    cueBallPath: [
      { x: 3.22, y: 3.86 },
      { x: 3.94, y: 3.53 },
    ],
    english: { x: -0.5, y: -0.8 },
    power: 0.57,
    description:
      "Nearly straight-in to the corner with left (outside) english and draw. The CB pulls back diagonally across the table, kisses the far long rail, and lands just off it.",
    technique:
      "Left english plus low draw. On a near-straight shot the draw does the work — a small cut angle is enough to send the CB back diagonally instead of straight back.",
    commonMistakes: [
      "Inside english instead of outside — OB throws into the rail",
      "Decelerating into the ball → no draw",
    ],
    tips: [
      "Outside english helps hold the OB on its pocket line",
      "Pace and draw together control where the CB lands",
    ],
    teaches:
      "Outside-english draw — combining cut-friendly side spin with controlled draw distance.",
  },
  {
    id: "two-rail-out-of-corner",
    number: 22,
    name: "Two Rails Out of the Corner",
    shortName: "2 Rails Out",
    series: "Top Dogs Workout",
    difficulty: "Intermediate",
    cueBall: { x: 5, y: 2.3 },
    objectBall: { x: 4, y: 0.4 },
    targetPocket: "MR",
    cueBallPath: [
      { x: 0.14, y: 1.51 },
      { x: 2.05, y: 3.86 },
      { x: 4.25, y: 2.43 },
    ],
    english: { x: -0.3, y: -0.6 },
    power: 0.685,
    description:
      "Pocket the OB in the side and send the cue ball two rails — short rail then far long rail — back to the center of the table.",
    technique:
      "Low-left english (a little draw with left spin), medium pace. Just enough draw to start the back-and-around path.",
    commonMistakes: [
      "Too much draw → CB takes a sharper exit and misses the corner-out path",
      "No left english → CB doesn't kick wide off the short rail",
    ],
    tips: [
      "Low and left, but neither one big — small amounts of each",
      "Visualize the corner-out wrap before stroking",
    ],
    teaches:
      "Coming out of a side-pocket cut with a controlled two-rail return.",
  },
  {
    id: "around-the-table-side-pocket",
    number: 23,
    name: "Around the Table — Side Pocket",
    shortName: "Around (Side)",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 3, y: 2 },
    objectBall: { x: 3.6, y: 0.45 },
    targetPocket: "MR",
    cueBallPath: [
      { x: 2.88, y: 0.14 },
      { x: 0.14, y: 1.48 },
      { x: 1.77, y: 3.86 },
      { x: 5.94, y: 1.04 },
    ],
    english: { x: -0.5, y: 0.25 },
    power: 0.84,
    description:
      "Pocket the OB in the side and wrap the cue ball around three rails — near long rail, short rail, far long rail — to land down-table, past the side pocket near the right rail.",
    technique:
      "Running english with follow, firm pace. The wrap pattern only holds if the english carries through every rebound.",
    commonMistakes: [
      "Pace dies on the second rail — third rebound never happens",
      "Wrong english angle → pattern collapses early",
    ],
    tips: [
      "Pick the third-rail target diamond first",
      "Running english is the constant — pace dictates distance",
    ],
    teaches:
      "Multi-rail wrap pattern coming out of a side-pocket cut.",
  },
  {
    id: "long-diagonal-scratch-aware",
    number: 24,
    name: "Long Diagonal — Watch the Scratch",
    shortName: "Scratch Aware",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 3, y: 1.8 },
    objectBall: { x: 3.6, y: 0.45 },
    targetPocket: "MR",
    cueBallPath: [
      { x: 2.84, y: 0.14 },
      { x: 0.14, y: 1.17 },
      { x: 2.08, y: 3.86 },
      { x: 5.91, y: 2.02 },
    ],
    english: { x: -0.5, y: 0 },
    power: 0.855,
    description:
      "Same setup as the around-the-table side-pocket shot with the cue ball a little closer to the rail. The long diagonal path off the third rail crosses scratch lines into multiple pockets — the drill is reading and avoiding them.",
    technique:
      "Running english, firm pace. The challenge is the path crosses scratch lines — read the rebound chain before stroking.",
    commonMistakes: [
      "Scratching in the opposite corner",
      "Scratching in the far side pocket on the second rebound",
    ],
    tips: [
      "Trace the full path on the cloth before stroking — every rebound point matters",
      "If a scratch line is unavoidable, change pace to die before reaching it",
    ],
    teaches:
      "Scratch-line awareness in multi-rail position routes.",
  },
  {
    id: "jump-shot-cloth-warning",
    number: 25,
    name: "Jump Shot — Tears Up Cloth",
    shortName: "Jump Shot",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 5, y: 0.4 },
    objectBall: { x: 1.5, y: 0.4 },
    targetPocket: "TR",
    cueBallPath: [{ x: 1.31, y: 0.79 }],
    english: { x: 0, y: 0.2 },
    power: 0.255,
    description:
      "Jump-shot setup with the OB on the rail line near the corner. The technique works, but it tears up the cloth — only use it when there's no other option. Better to find a kick, a curve, or a different angle whenever possible.",
    technique:
      "Cue elevated 45° or more, short stroke, hit down through the cue ball just above center. Legal jump — never scoop.",
    commonMistakes: [
      "Scooping (illegal)",
      "Repeatedly jumping in practice → ruins cloth and rails",
      "Hitting the blocker first",
    ],
    tips: [
      "Reserve jumps for real game situations — practice them sparingly",
      "Look for an alternative route first; jump is the last resort",
    ],
    teaches:
      "Legal jump mechanics and when not to use them. Cloth lasts longer when you respect it.",
  },
  {
    id: "run-six-balls",
    number: 26,
    name: "Run Six Balls",
    shortName: "Run 6",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 1.5, y: 1.8 },
    objectBall: { x: 0.4, y: 0.6 },
    targetPocket: "TR",
    cueBallPath: [{ x: 0.8, y: 1.2 }],
    english: { x: 0, y: 0 },
    sequence: [
      {
        ball: { x: 0.4, y: 0.6 },
        pocket: "TR",
        cueAfter: { x: 0.8, y: 1.2 },
      },
      {
        ball: { x: 0.4, y: 1.5 },
        pocket: "TR",
        cueAfter: { x: 0.9, y: 2 },
      },
      {
        ball: { x: 0.4, y: 2.2 },
        pocket: "TR",
        cueAfter: { x: 1.4, y: 1.4 },
      },
      {
        ball: { x: 1.3, y: 0.5 },
        pocket: "TR",
        cueAfter: { x: 1.7, y: 0.9 },
      },
      {
        ball: { x: 1.9, y: 0.4 },
        pocket: "TR",
        cueAfter: { x: 2.3, y: 0.8 },
      },
      {
        ball: { x: 2.6, y: 0.4 },
        pocket: "TR",
        cueAfter: { x: 2.6, y: 1.4 },
      },
    ],
    description:
      "Six object balls clustered around the corner pocket and the head end of the right rail. Run them one at a time in the order shown, with the cue ball cycling through small position moves between each shot. The whole drill stays in the head end of the table.",
    technique:
      "Soft touch, minimal english. Each shot is short and the cue ball moves only a diamond or two between balls.",
    commonMistakes: [
      "Over-hitting → CB runs out of the work area",
      "Treating each ball differently — the goal is repeatable shape",
    ],
    tips: [
      "Plan the next two balls, not just the current one",
      "Score yourself out of six — track progress across sessions",
    ],
    teaches:
      "Tight-area position play and disciplined low-energy stroke patterns.",
  },
  {
    id: "dead-level-draw",
    number: 27,
    name: "Dead Level Draw — No Rail",
    shortName: "Level Draw",
    series: "Top Dogs Workout",
    difficulty: "Advanced",
    cueBall: { x: 5.5, y: 0.6 },
    objectBall: { x: 2.5, y: 0.27 },
    targetPocket: "TR",
    cueBallPath: [{ x: 5.27, y: 0.53 }],
    english: { x: 0, y: -0.5 },
    power: 0.735,
    description:
      "Rail-line cut into the corner. Draw the cue ball back along the same line and stop it before it touches a rail — perfectly level cue, perfectly controlled draw.",
    technique:
      "Dead level cue, low draw, smooth pace. The drill exposes any unintended english that walks the CB into the cushion.",
    commonMistakes: [
      "Cue elevation → CB curves into the rail",
      "Unintended side spin → CB drifts and hits the long rail",
      "Too much pace → CB sails past start without stopping",
    ],
    tips: [
      "Check your bridge height — anything but level introduces curve at draw distances",
      "Stay smooth and let pace dictate distance",
    ],
    teaches:
      "Cue-level discipline. The single biggest fix for inconsistent draw at distance.",
  },
];

export function getShot(id: string): KinisterShot | undefined {
  return KINISTER_SHOTS.find((s) => s.id === id);
}
