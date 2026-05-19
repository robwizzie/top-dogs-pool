import type { DiamondCoord, PocketId } from "./shots";
import { POCKETS } from "./shots";

/**
 * Human-readable description of a ball position in diamond terms.
 *
 * The diamond grid runs 0..8 long axis (0 = head rail, 8 = foot rail) and
 * 0..4 short axis (0 = right rail, 4 = left rail). We translate that into
 * the language a player actually uses while setting balls on a real table:
 * "1 diamond from the right rail, 3 diamonds down from the head rail",
 * "right on the right rail at the 2nd diamond", etc.
 */
export function describePosition(coord: DiamondCoord): string {
  const { x, y } = coord;
  const NEAR_RAIL = 0.45;

  // On a long rail — express as "Nth diamond from the corner pocket".
  if (y < NEAR_RAIL) {
    return `On the right rail, ${formatDiamonds(x)} from the TR corner pocket`;
  }
  if (y > 4 - NEAR_RAIL) {
    return `On the left rail, ${formatDiamonds(x)} from the TL corner pocket`;
  }

  // On a short rail.
  if (x < NEAR_RAIL) {
    return `On the head rail, ${formatDiamonds(4 - y)} from the TL corner pocket`;
  }
  if (x > 8 - NEAR_RAIL) {
    return `On the foot rail, ${formatDiamonds(4 - y)} from the BL corner pocket`;
  }

  // In the open — describe distances from two nearest rails.
  const fromHead = x < 8 - x;
  const fromRight = y < 4 - y;
  const vertical = fromHead
    ? `${formatDiamonds(x)} off the head rail`
    : `${formatDiamonds(8 - x)} off the foot rail`;
  const horizontal = fromRight
    ? `${formatDiamonds(y)} off the right rail`
    : `${formatDiamonds(4 - y)} off the left rail`;
  return `${vertical}, ${horizontal}`;
}

/**
 * Human-readable description of a target pocket.
 */
export function pocketLabel(id: PocketId): string {
  switch (id) {
    case "TR":
      return "Top-right corner pocket";
    case "TL":
      return "Top-left corner pocket";
    case "BR":
      return "Bottom-right corner pocket";
    case "BL":
      return "Bottom-left corner pocket";
    case "MR":
      return "Right side pocket";
    case "ML":
      return "Left side pocket";
  }
}

export function pocketCoord(id: PocketId): DiamondCoord {
  return POCKETS[id];
}

function formatDiamonds(d: number): string {
  const rounded = Math.round(d * 2) / 2; // snap to half-diamonds
  if (rounded <= 0.25) return "tucked against the corner";
  if (rounded === 0.5) return "½ a diamond";
  if (rounded === 1) return "1 diamond";
  // Show .5 / .0 distinctly, otherwise round to the nearest half.
  if (rounded % 1 === 0) return `${rounded} diamonds`;
  return `${rounded} diamonds`;
}
