/**
 * Practice drills — sister catalog to the single-shot `shots.ts`.
 *
 * Drills are routines/exercises rather than single shots: they may involve
 * many balls, sequential pocketing, or scoring rules. Coordinates use the
 * same diamond grid as shots.ts.
 */

import type { DiamondCoord, Difficulty } from "./shots";

export type Drill = {
  id: string;
  name: string;
  shortName: string;
  difficulty: Difficulty;
  /** One-paragraph overview of the drill. */
  description: string;
  /** Step-by-step setup notes. */
  setup: string[];
  /** What the drill teaches and how to score yourself. */
  goals: string[];
  /** Optional CB starting position for the diagram. */
  cueBall?: DiamondCoord;
  /** Optional OB positions for the diagram. */
  objectBalls?: DiamondCoord[];
  /** Optional faded "progression" balls (e.g., ladder rungs). */
  ghostBalls?: DiamondCoord[];
  /** Optional external reference link. */
  externalUrl?: string;
  externalLabel?: string;
};

export const DRILLS: Drill[] = [
  {
    id: "ladder-drill",
    name: "The Ladder Drill",
    shortName: "Ladder",
    difficulty: "Foundational",
    description:
      "Pure stop-shot drill at increasing distances. The OB starts one diamond in front of the cue ball; you pocket it with a stop shot, move the OB back one diamond, and repeat until the OB reaches the foot rail. Miss anywhere and you start over from rung one.",
    setup: [
      "Cue ball on the head spot (2 diamonds from the head rail, centerline)",
      "Object ball one diamond in front of the cue ball, aligned to the foot-corner pocket",
      "After each made ball, move the OB one diamond further toward the foot rail",
      "Continue until the OB sits on or past the foot spot",
    ],
    goals: [
      "Recalibrate stop-shot speed for every distance",
      "Pure center-ball contact at every rung — any unintended draw or follow shows immediately",
      "Score yourself on the highest rung reached without a miss",
    ],
    cueBall: { x: 2, y: 2 },
    objectBalls: [{ x: 3, y: 2 }],
    ghostBalls: [
      { x: 4, y: 2 },
      { x: 5, y: 2 },
      { x: 6, y: 2 },
      { x: 7, y: 2 },
    ],
  },
  {
    id: "wagon-wheel",
    name: "Wagon Wheel",
    shortName: "Wagon Wheel",
    difficulty: "Intermediate",
    description:
      "One object ball on the foot spot, cue ball at center table. Six numbered landing zones around the table. Pocket the OB in the same corner every rep and land the cue ball in each zone in sequence — cycling through follow, draw, stun, with and without english.",
    setup: [
      "Object ball on the foot spot",
      "Cue ball at center table for every rep",
      "Visualize six landing zones (head corner, head rail center, head corner mirror, side, foot corner, foot rail center)",
      "Cycle through them in order each session",
    ],
    goals: [
      "Demonstrate every basic CB control technique off a single OB position",
      "Score yourself out of 6 — track progress across sessions",
      "Identify which zones you struggle with and build sub-drills around them",
    ],
    cueBall: { x: 4, y: 2 },
    objectBalls: [{ x: 6, y: 2 }],
    ghostBalls: [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 2 },
      { x: 0.5, y: 3.5 },
      { x: 4, y: 0.5 },
      { x: 4, y: 3.5 },
      { x: 7.5, y: 3.5 },
    ],
  },
  {
    id: "mighty-x",
    name: "The Mighty X",
    shortName: "Mighty X",
    difficulty: "Foundational",
    description:
      "Kinister's signature stroke-honesty drill. Place the cue ball and object ball on the long table diagonal — OB near one corner, CB near the diagonally opposite corner. Shoot the OB straight in. Cycle through stop, replace, follow, and draw variants. The diagonal exposes any flaw in your stance or stroke.",
    setup: [
      "Object ball near one corner pocket on the long diagonal",
      "Cue ball near the diagonally opposite corner",
      "Same pre-shot routine every rep — one practice stroke or none",
    ],
    goals: [
      "Lock in body alignment, vision center, level cue, and a straight stroke",
      "Cycle stop / replace / follow / draw on the same shape",
      "Find and eliminate inconsistencies in your address",
    ],
    cueBall: { x: 6, y: 1 },
    objectBalls: [{ x: 2, y: 3 }],
    externalUrl: "https://www.youtube.com/watch?v=VinL0GpyNk4",
    externalLabel: "Watch Bert Kinister — The Mighty X",
  },
  {
    id: "line-up-drill",
    name: "Line-Up Drill (15 Balls)",
    shortName: "Line-Up",
    difficulty: "Intermediate",
    description:
      "Fifteen object balls lined up on the long string between the side pocket and the foot rail. Break the line with the cue ball, then run as many as you can. The pre-arranged line forces you to read clusters, choose pockets, and manage cue-ball traffic.",
    setup: [
      "Place 15 balls on the long center string, foot end, evenly spaced",
      "Cue ball in hand behind the head string",
      "Break into the line with controlled pace — not a full break",
      "Run as many balls as you can in any order",
    ],
    goals: [
      "Track high-run records over sessions",
      "Build cluster-reading and pocket-selection instincts",
      "Practice transitioning between offense and break-out shots",
    ],
    cueBall: { x: 2, y: 2 },
    objectBalls: [
      { x: 4.2, y: 2 },
      { x: 4.5, y: 2 },
      { x: 4.8, y: 2 },
      { x: 5.1, y: 2 },
      { x: 5.4, y: 2 },
      { x: 5.7, y: 2 },
      { x: 6.0, y: 2 },
      { x: 6.3, y: 2 },
      { x: 6.6, y: 2 },
      { x: 6.9, y: 2 },
      { x: 7.2, y: 2 },
    ],
  },
  {
    id: "nine-ball-ghost",
    name: "9-Ball Ghost",
    shortName: "9-Ball Ghost",
    difficulty: "Advanced",
    description:
      "Play a race against \"the Ghost\" — an opponent who never misses. Rack nine balls, break, take ball-in-hand on the first shot, and run the rack. Any miss or scratch loses the game. Win the rack to win the game. Race the Ghost to 7 (or any target) to measure your shotmaking under match-style pressure.",
    setup: [
      "Standard 9-ball rack on the foot spot",
      "Break the rack — any legal break",
      "Take ball-in-hand after the break",
      "Run all nine balls in rotation; any miss or scratch is a loss",
    ],
    goals: [
      "Treat each rack as a real game — pressure builds the skill",
      "Track win rate against the Ghost across sessions",
      "Identify the shot you miss most often and drill it separately",
    ],
  },
  {
    id: "bowliards",
    name: "Bowliards",
    shortName: "Bowliards",
    difficulty: "Intermediate",
    description:
      "Bowling-style scoring on a pool table. Rack ten balls, break, and run as many as you can — each ball counts one point, with strikes (all 10 in a row) and spares (clear the table in two innings) bonused like bowling. Ten frames per game. The format keeps every rack relevant and gives you a real number to chase.",
    setup: [
      "Rack ten balls (any pattern works — many people use 1-10)",
      "Cue ball in hand behind the head string",
      "Break, then run balls in any order",
      "Each made ball = 1 point. Clear the rack in one inning = strike (bonus next two innings). Two innings = spare (bonus next inning).",
      "Play ten frames per game",
    ],
    goals: [
      "Track a single score across every rack of every session",
      "Compete against your previous best",
      "Builds running discipline and break-and-run frequency",
    ],
  },
];

export function getDrill(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}
