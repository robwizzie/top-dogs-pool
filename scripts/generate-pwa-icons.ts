import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, "public", "logo.png");
const OUT = join(ROOT, "public", "icons");

// Brand colors — keep in sync with globals.css / themeColor in layout.tsx.
const FELT_BG = "#0b3326"; // deep felt green
const DARK_BG = "#070707"; // page background

/**
 * Render the logo onto a colored canvas at a given size, with optional
 * inner padding (the "safe zone" — Android crops maskable icons to a
 * circle/squircle ~80% of the canvas).
 */
async function composite(opts: {
  outPath: string;
  size: number;
  background: string;
  /** 0..1 — fraction of the canvas the logo should occupy. */
  logoScale: number;
}) {
  const { outPath, size, background, logoScale } = opts;
  const inner = Math.round(size * logoScale);
  const logoBuf = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: logoBuf, gravity: "center" }])
    .png()
    .toFile(outPath);
  console.log(`  wrote ${outPath.replace(ROOT + "/", "")}`);
}

/**
 * Render the logo at its native aspect into a transparent canvas — used
 * for the "any" purpose icons (browsers may show on light or dark chrome,
 * so transparency is friendlier than a fixed background).
 */
async function transparent(outPath: string, size: number) {
  await sharp(SRC)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log(`  wrote ${outPath.replace(ROOT + "/", "")}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log("Generating PWA icons from public/logo.png…");

  // Transparent "any" icons — used by browsers and PWA installers that
  // composite their own background.
  await transparent(join(OUT, "icon-192.png"), 192);
  await transparent(join(OUT, "icon-512.png"), 512);

  // Maskable icons — Android adaptive icon, padded so the logo stays
  // inside the safe zone after the system mask is applied.
  await composite({
    outPath: join(OUT, "icon-maskable-192.png"),
    size: 192,
    background: FELT_BG,
    logoScale: 0.7,
  });
  await composite({
    outPath: join(OUT, "icon-maskable-512.png"),
    size: 512,
    background: FELT_BG,
    logoScale: 0.7,
  });

  // Apple touch icon — iOS doesn't mask; the logo can fill more of the
  // canvas and the background gives it the polished, deliberate look you
  // get from a real app icon.
  await composite({
    outPath: join(OUT, "apple-touch-icon.png"),
    size: 180,
    background: DARK_BG,
    logoScale: 0.85,
  });

  // Favicons.
  await transparent(join(OUT, "favicon-32.png"), 32);
  await transparent(join(OUT, "favicon-16.png"), 16);

  console.log("✓ Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
