import { NextResponse } from "next/server";
import { getShot, POCKETS } from "@/lib/kinister/shots";
import {
  cutAngle,
  describePosition,
  pocketLabel,
} from "@/lib/kinister/setup";

export const runtime = "nodejs";
// Keep the route dynamic so frames aren't cached.
export const dynamic = "force-dynamic";

type ShotFeedbackRequest = {
  shotId: string;
  /** Each frame is a data URL: "data:image/jpeg;base64,..." */
  frames: string[];
};

type ShotFeedbackResponse =
  | {
      ok: true;
      summary: string;
      verdict: "looked great" | "needs work" | "uncertain";
    }
  | { ok: false; error: string };

/**
 * Sends the captured frames + shot context to Gemini Flash and returns
 * a short narrative critique. The API is intentionally pluggable —
 * swap the model env var or move to a different provider without
 * touching the client.
 *
 * Requires GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) set in env.
 */
export async function POST(req: Request) {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  let body: ShotFeedbackRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ShotFeedbackResponse>(
      { ok: false, error: "Invalid request body — expected JSON" },
      { status: 400 },
    );
  }

  if (!body.shotId || !Array.isArray(body.frames) || body.frames.length === 0) {
    return NextResponse.json<ShotFeedbackResponse>(
      { ok: false, error: "Missing shotId or frames" },
      { status: 400 },
    );
  }

  const shot = getShot(body.shotId);
  if (!shot) {
    return NextResponse.json<ShotFeedbackResponse>(
      { ok: false, error: "Unknown shotId" },
      { status: 404 },
    );
  }

  if (!apiKey) {
    return NextResponse.json<ShotFeedbackResponse>(
      {
        ok: false,
        error:
          "AI feedback isn't configured on this deployment. Set GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) in env to enable it.",
      },
      { status: 503 },
    );
  }

  // Cap how many frames we forward so a runaway client can't blow up cost.
  const frames = body.frames.slice(0, 12);

  // Build a coaching prompt with everything the model needs to give
  // shot-specific feedback rather than generic pool advice.
  const cut =
    shot.targetPocket &&
    cutAngle(shot.cueBall, shot.objectBall, POCKETS[shot.targetPocket]);
  const context = [
    `Shot name: ${shot.name}`,
    `Difficulty: ${shot.difficulty}`,
    `Cue ball start: ${describePosition(shot.cueBall)}`,
    `Object ball: ${describePosition(shot.objectBall)}`,
    shot.targetPocket
      ? `Target pocket: ${pocketLabel(shot.targetPocket)}`
      : "Target: safety / kick",
    cut ? `Cut angle: ${cut.label} (${cut.degrees.toFixed(0)}°)` : null,
    `Technique notes: ${shot.technique}`,
    shot.english
      ? `Intended english: x=${shot.english.x.toFixed(2)} (left/right), y=${shot.english.y.toFixed(2)} (low/high)`
      : null,
    `Common mistakes to watch for: ${shot.commonMistakes.join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You are a pool coach reviewing a short clip of a single shot. The frames below were captured in order while the player executed the shot. Use the shot context to judge whether they pulled it off, and call out specific issues you can see (stroke, alignment, contact, speed, follow-through, cue-ball end position, etc.).

Respond with two sections separated by a line:
1. VERDICT — one of "looked great", "needs work", or "uncertain" (use "uncertain" only if the video isn't clear enough to call it).
2. NOTES — 2-3 sentences of specific, actionable feedback. Mention the player's likely error if you spotted one, or what they did well if it looked clean. No generic pool platitudes.

Shot context:
${context}`;

  const parts: object[] = [{ text: systemPrompt }];
  for (const frame of frames) {
    const m = frame.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!m) continue;
    parts.push({
      inlineData: { mimeType: m[1], data: m[2] },
    });
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        // Keep responses brief and predictable.
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 400,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json<ShotFeedbackResponse>(
        { ok: false, error: `Model error: ${res.status} ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const { verdict, summary } = parseModelReply(raw);
    return NextResponse.json<ShotFeedbackResponse>({
      ok: true,
      summary,
      verdict,
    });
  } catch (err) {
    return NextResponse.json<ShotFeedbackResponse>(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Failed to reach the model",
      },
      { status: 502 },
    );
  }
}

function parseModelReply(raw: string): {
  verdict: "looked great" | "needs work" | "uncertain";
  summary: string;
} {
  const lower = raw.toLowerCase();
  let verdict: "looked great" | "needs work" | "uncertain" = "uncertain";
  if (lower.includes("looked great")) verdict = "looked great";
  else if (lower.includes("needs work")) verdict = "needs work";
  // Pull out the NOTES section, or fall back to the whole reply.
  const m = raw.match(/notes\s*[—:\-]\s*([\s\S]+)$/i);
  const summary = (m?.[1] ?? raw)
    .replace(/^verdict[^\n]*\n?/gi, "")
    .replace(/^notes[^\n]*\n?/gi, "")
    .trim();
  return { verdict, summary };
}
