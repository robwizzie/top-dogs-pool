export type GlossaryEntry = {
  term: string;
  /** Alternate names / lookup aliases. */
  aliases?: string[];
  short: string;
  long?: string;
  /** Roughly grouped — used for the section dividers on the glossary page. */
  category: "Stroke" | "Geometry" | "Position" | "Table";
};

/**
 * Quick-reference pool terms. Edit liberally — this is a teaching aid, not
 * an exhaustive rulebook.
 */
export const GLOSSARY: GlossaryEntry[] = [
  // Stroke / english
  {
    term: "English",
    aliases: ["side", "sidespin"],
    short: "Sidespin applied by hitting the cue ball left or right of center.",
    long: "English changes how the cue ball comes off rails and (in small doses) the angle the object ball squirts off contact. The further off-center you contact the cue ball, the more spin you apply — and the more the cue stick deflects (see Deflection).",
    category: "Stroke",
  },
  {
    term: "Follow",
    aliases: ["top", "topspin", "high english"],
    short: "Topspin from hitting the cue ball above center.",
    long: "Follow makes the cue ball continue forward after contact, instead of stopping or drawing back. Used to send the CB the same direction the OB went.",
    category: "Stroke",
  },
  {
    term: "Draw",
    aliases: ["bottom", "backspin", "low english"],
    short: "Backspin from hitting the cue ball below center.",
    long: "Draw makes the cue ball reverse direction after contact, pulling back toward the shooter. Requires a smooth, accelerating stroke and a level cue.",
    category: "Stroke",
  },
  {
    term: "Stun",
    short:
      "A shot where the cue ball has neither follow nor draw at contact.",
    long: "On a stun shot the cue ball travels purely along the tangent line at impact. The stop shot is the special case where the tangent line points back at the shooter (straight shot) so the CB stops dead.",
    category: "Stroke",
  },
  {
    term: "Stop shot",
    short: "A stun shot on a straight-in angle so the cue ball stops dead.",
    long: "Center-ball, medium pace, perfectly straight contact. The OB carries all the energy and the CB freezes where it struck.",
    category: "Stroke",
  },
  {
    term: "Inside english",
    short: "English on the same side as the cut (left english on a left cut).",
    long: "Holds the OB on its pocket line and tends to shorten the cue ball's rebound off the first rail.",
    category: "Stroke",
  },
  {
    term: "Outside english",
    short:
      "English on the opposite side of the cut (right english on a left cut).",
    long: "Opens the cut angle (the OB tends to slide more), widens the rebound off the first rail.",
    category: "Stroke",
  },
  {
    term: "Running english",
    short: "Side english that opens the angle off a rail.",
    long: "Whether english is 'running' depends on which rail you hit and which direction you're heading. Running english keeps the cue ball moving along its rebound path; reverse english (the opposite side) shortens it.",
    category: "Stroke",
  },
  {
    term: "Deflection",
    aliases: ["squirt"],
    short:
      "The cue ball going slightly off line because of the side english you applied.",
    long: "When you hit off-center, the cue stick pushes the cue ball away from the spin direction. Every shaft squirts a little differently — you compensate by aiming slightly the opposite way.",
    category: "Stroke",
  },
  // Geometry / aiming
  {
    term: "Cut angle",
    short:
      "The angle between the cue-ball-to-object-ball line and the object-ball-to-pocket line.",
    long: "0° is straight; the bigger the cut angle, the thinner the contact and the less energy transferred to the OB.",
    category: "Geometry",
  },
  {
    term: "Ghost ball",
    short:
      "An imagined position of the cue ball at the moment of impact. Aim at the ghost ball.",
    long: "The ghost ball sits one ball-diameter behind the object ball along the line from the pocket. Line up so the cue ball's center will arrive at the ghost ball's center, and the OB rolls dead-straight into the target pocket.",
    category: "Geometry",
  },
  {
    term: "Tangent line",
    short:
      "The 90° line perpendicular to the object ball's direction after contact.",
    long: "On a stun shot the cue ball travels along this line — that's why it's the foundation of CB position control.",
    category: "Geometry",
  },
  {
    term: "Half-ball cut",
    short: "About a 30° cut — aim the cue ball center at the edge of the OB.",
    long: "The most-used reference cut angle. ¾-ball is straighter (~15°), ¼-ball is thinner (~48°).",
    category: "Geometry",
  },
  {
    term: "Aim line",
    short:
      "The line from the cue ball through the ghost ball to the contact point on the OB.",
    long: "Sight down this line, stroke through it. The dashed white line on the diagram before you press Play is the aim line for the catalogued shot.",
    category: "Geometry",
  },
  // Position / shape
  {
    term: "Position / shape",
    short: "Where the cue ball lands after the shot.",
    long: "Good shape means the CB stops on the right side of the next OB at the right distance and angle. Most of the Top Dogs catalog is about training shape, not just pocketing.",
    category: "Position",
  },
  {
    term: "Speed control",
    short: "Controlling exactly how hard you hit to land the CB on a target.",
    long: "Often more important than angle. Two players hitting the same angle at different speeds end up in completely different positions.",
    category: "Position",
  },
  {
    term: "Pocket speed",
    short: "Just enough speed to roll the OB into the pocket cleanly.",
    long: "Slow speed makes the pockets play larger — even a partly blocked pocket will accept a slow ball. Trains aim by removing pace.",
    category: "Position",
  },
  {
    term: "Scratch",
    short: "Pocketing the cue ball. Foul — opponent gets ball in hand.",
    category: "Position",
  },
  // Table / equipment
  {
    term: "Diamond",
    aliases: ["sight", "diamonds"],
    short: "The decorative spots along the rails used as aiming references.",
    long: "Standard tables have 3 diamonds per long rail between the corner pocket and the side pocket, and 3 across each short rail (every other diamond is doubled into the side pocket). Used heavily in kicking and banking systems.",
    category: "Table",
  },
  {
    term: "Head rail",
    short: "The short rail at the head end of the table — where the break is from.",
    category: "Table",
  },
  {
    term: "Foot rail",
    short: "The short rail at the foot end — where the rack sits.",
    category: "Table",
  },
  {
    term: "Long rail",
    aliases: ["side rail"],
    short: "Either of the two long rails (the sides of the playing surface).",
    category: "Table",
  },
  {
    term: "Side pocket",
    short: "The two pockets at the midpoint of the long rails.",
    category: "Table",
  },
  {
    term: "Cushion",
    aliases: ["rail rubber"],
    short: "The rubber-covered inner edge of the rail that the ball rebounds off.",
    category: "Table",
  },
];

/**
 * Look up a term (case-insensitive, also checks aliases). Returns undefined
 * if there's no exact match — we don't fuzzy-match to avoid wrong hits in
 * tooltips.
 */
export function lookupTerm(query: string): GlossaryEntry | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return GLOSSARY.find((e) => {
    if (e.term.toLowerCase() === q) return true;
    return e.aliases?.some((a) => a.toLowerCase() === q) ?? false;
  });
}
