import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Shared loaders for the `opengraph-image` routes.
 *
 * The cards are prerendered at build time, so reading from disk here happens
 * once, during `next build`, not per request. Fonts are vendored (OFL) under
 * assets/og-fonts rather than fetched from Google, so a build never depends on
 * the network and Satori gets static TTFs — it can't read variable fonts.
 */

type OgFont = {
  name: string;
  data: Buffer;
  weight: 400 | 600;
  style: "normal" | "italic";
};

const font = async (file: string) => readFile(join(process.cwd(), "assets", "og-fonts", file));

export async function siteFonts(): Promise<OgFont[]> {
  const [bebas, serif, poppins] = await Promise.all([
    font("BebasNeue-Regular.ttf"),
    font("InstrumentSerif-Italic.ttf"),
    font("Poppins-SemiBold.ttf"),
  ]);
  return [
    { name: "Bebas Neue", data: bebas, weight: 400, style: "normal" },
    { name: "Instrument Serif", data: serif, weight: 400, style: "italic" },
    { name: "Poppins", data: poppins, weight: 600, style: "normal" },
  ];
}

export async function rackFonts(): Promise<OgFont[]> {
  const [lilita, poppins] = await Promise.all([font("LilitaOne-Regular.ttf"), font("Poppins-SemiBold.ttf")]);
  return [
    { name: "Lilita One", data: lilita, weight: 400, style: "normal" },
    { name: "Poppins", data: poppins, weight: 600, style: "normal" },
  ];
}

/** A file from /public as a data URI, for an <img> inside the card. */
export async function publicImage(relPath: string, mime = "image/png"): Promise<string> {
  const buf = await readFile(join(process.cwd(), "public", relPath));
  return `data:${mime};base64,${buf.toString("base64")}`;
}
