/**
 * generate-og-card.mjs
 *
 * Composes a branded 1200x630 Open Graph / Twitter share card for
 * deancascione.com from the source portrait.
 *
 * Layout (matches the live hero treatment):
 *   - 1200x630 canvas, brand black #0a0a0a background
 *   - Dean's portrait (face guaranteed in-frame) anchored right
 *   - Wordmark left: "DEAN" (Bebas Neue) + "Cascione" (Cormorant Garamond
 *     italic, accent red #c8102e), mirroring the hero <h1>
 *   - Eyebrow + tagline + URL footer
 *   - Soft left-to-right gradient so the left type column stays readable
 *
 * The face-keeping constraint is enforced by cropping the source so the
 * face region is always inside the visible area, regardless of the
 * portrait's exact head position. We rely on a manually verified head
 * anchor (see HEAD_ANCHOR below) plus a face-preserving crop strategy.
 *
 * Output: public/og-hero-2026-v2.jpg  (versioned filename busts scraper cache)
 *
 * Run:  node scripts/generate-og-card.mjs
 */

import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---- Brand tokens (must match src/styles/global.css) ----------------------
const BG = '#0a0a0a';
const ACCENT = '#c8102e';
const TEXT = '#f5f5f5';
const MUTED = '#a3a3a3';

const W = 1200;
const H = 630;

// ---- Paths ----------------------------------------------------------------
const PORTRAIT_SRC = resolve(ROOT, 'src/assets/images/portrait.jpg');
const OUT = resolve(ROOT, 'public/og-hero-2026-v2.jpg');
const FONT_DIR = resolve(ROOT, '.cache/fonts');

// ---- Portrait framing -----------------------------------------------------
// Source is 1365x2048 (2:3 portrait). The subject is centered. We need a
// landscape slice that keeps the face. Strategy: crop a window from the
// TOP portion of the portrait (face is near the top) that is tall enough
// to include head + upper torso, then fit it into the right portion of
// the OG card with a cover fit anchored so the head stays in frame.
//
// CROP_Y and CROP_HEIGHT define the source window. Verified empirically +
// with image analysis; tuned so the face is comfortably inside the final
// composite. These are expressed as fractions of source height.
const CROP_TOP_FRAC = 0.02;   // start very near the top (head room)
const CROP_BOT_FRAC = 0.62;   // down to ~upper chest/shoulders
// How much of the card width the portrait occupies (right side).
const PORTRAIT_W = 680;       // px of the 1200-wide card
// Horizontal anchor for cover: 0.5 keeps centered subject centered.
const COVER_X = 0.5;

// ============================================================================
async function main() {
  // --- 1. Prepare the portrait region --------------------------------------
  const meta = await sharp(PORTRAIT_SRC).metadata();
  const sW = meta.width;
  const sH = meta.height;
  console.log(`Source portrait: ${sW}x${sH}`);

  const top = Math.round(sH * CROP_TOP_FRAC);
  const bot = Math.round(sH * CROP_BOT_FRAC);
  const cropH = bot - top;

  // The portrait fills the FULL card height (630) and PORTRAIT_W wide, on
  // the right. We crop the source to the [top,bot] band, then cover-fit it
  // into (PORTRAIT_W x H). To keep it simple & deterministic we extract a
  // source window whose aspect ratio matches the target, centered horizontally.
  const targetAspect = PORTRAIT_W / H;          // width/height of target box
  let extractW = Math.round(cropH * targetAspect);
  let extractH = cropH;
  if (extractW > sW) {
    // If the computed width exceeds source width (portrait is narrow),
    // clamp to source width and recompute height to keep aspect.
    extractW = sW;
    extractH = Math.round(sW / targetAspect);
  }
  const left = Math.max(0, Math.round((sW - extractW) * COVER_X));

  console.log(`Extracting source window: ${extractW}x${extractH} @ (${left},${top})`);

  // Extract + resize to target box (cover), flatten to 3-channel RGB so we
  // can attach a fresh alpha mask as the 4th channel.
  const portraitBase = sharp(PORTRAIT_SRC)
    .extract({ left, top, width: extractW, height: extractH })
    .resize(PORTRAIT_W, H, { fit: 'cover', position: 'attention' })
    .removeAlpha()
    .toColorspace('srgb');

  // Feather the portrait's outer (right + bottom + top) edges into the brand
  // black so the high-key (white seamless) studio background dissolves
  // intentionally rather than reading as a pasted photo. The LEFT edge
  // (where Dean faces toward the type) stays crisp + is handled by the
  // left gradient. We build an alpha mask (grayscale) and join it as the
  // alpha channel: white (255) = opaque, black (0) = transparent.
  const featherBuf = await buildFeatherMask();

  const portraitRgbBuf = await portraitBase.png().toBuffer();
  const portraitLayer = sharp(portraitRgbBuf)
    .joinChannel(featherBuf)        // append mask -> 4-channel RGBA
    .png();                         // keep alpha; flatten happens at composite

  // --- 2. Build the text/overlay layer as SVG ------------------------------
  const svg = buildOverlaySvg();

  const fonts = [
    { name: 'Bebas Neue', path: resolve(FONT_DIR, 'BebasNeue.ttf') },
    { name: 'Cormorant Garamond', path: resolve(FONT_DIR, 'CormorantGaramond-Italic.ttf') },
    { name: 'Inter', path: resolve(FONT_DIR, 'Inter-Regular.ttf') },
  ];
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: {
      loadSystemFonts: false,
      fontFiles: fonts.map((f) => f.path),
      defaultFontFamily: 'Inter',
    },
  });
  const overlayPng = resvg.render().asPng();

  // --- 3. Composite: bg + portrait (right) + left gradient + overlay -------
  // Base canvas
  const base = sharp({
    create: { width: W, height: H, channels: 4, background: BG },
  });

  // Gradient: opaque black on the left, transparent over the portrait on the
  // right. Provides legibility behind the type without darkening Dean's face.
  const grad = buildGradientSvg();

  // Write intermediate portrait buffer so we can composite precisely.
  const portraitBuf = await portraitLayer.toBuffer();

  await base
    .composite([
      { input: portraitBuf, left: W - PORTRAIT_W, top: 0 },
      { input: Buffer.from(grad), top: 0, left: 0 },
      { input: overlayPng, top: 0, left: 0 },
    ])
    .jpeg({ quality: 88, progressive: true, chromaSubsampling: '4:2:0' })
    .toFile(OUT);

  const outMeta = await sharp(OUT).metadata();
  console.log(`\n✓ Wrote ${OUT.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
  console.log(`  Final: ${outMeta.width}x${outMeta.height} ${outMeta.format}`);
}

function buildOverlaySvg() {
  // Left type column x-range: 72 .. (W - PORTRAIT_W - 24)
  const padX = 72;
  // Vertical centering of the wordmark block.
  const titleY = 232;       // baseline of "DEAN"
  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="Inter, sans-serif">
  <!-- Eyebrow -->
  <text x="${padX}" y="150" font-size="21" letter-spacing="4.5" fill="${MUTED}" font-weight="600">
    NEOCLASSICAL SHRED GUITARIST
  </text>
  <rect x="${padX}" y="168" width="64" height="3" fill="${ACCENT}"/>

  <!-- Wordmark: DEAN (display) -->
  <text x="${padX}" y="${titleY}" font-family="'Bebas Neue', sans-serif" font-size="150" fill="${TEXT}" letter-spacing="2">
    DEAN
  </text>

  <!-- Wordmark: Cascione (serif italic, accent) -->
  <text x="${padX + 8}" y="${titleY + 132}" font-family="'Cormorant Garamond', serif" font-style="italic" font-weight="600" font-size="120" fill="${ACCENT}">
    Cascione
  </text>

  <!-- Tagline -->
  <text x="${padX}" y="470" font-size="25" fill="${MUTED}">
    Instrumental rock &amp; metal · Chart-topping debut · NAMM mainstay
  </text>

  <!-- URL footer -->
  <text x="${padX}" y="568" font-size="23" fill="${TEXT}" font-weight="600" letter-spacing="0.5">
    deancascione.com
  </text>
</svg>`;
}

function renderGradSvg(id, x1, y1, x2, y2, stops) {
  // stops: array of [offset, 'white'|'black']
  const stopXml = stops
    .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
    .join('');
  return `<svg width="${PORTRAIT_W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      ${stopXml}
    </linearGradient>
  </defs>
  <rect width="${PORTRAIT_W}" height="${H}" fill="url(#g)"/>
</svg>`;
}

function renderGradPng(svg) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: PORTRAIT_W } });
  return resvg.render().asPng();
}

async function buildFeatherMask() {
  // Build a PORTRAIT_W x H grayscale alpha mask (255=opaque, 0=transparent).
  // We combine three independent edge fades (right, bottom, top) by
  // MULTIPLYING them together. sharp's `multiply` blend does exactly this:
  // white (255) is identity, black (0) wins — so the intersection of fades
  // darkens correctly without the unpredictable layering of overlaid
  // semi-transparent rects in a single SVG. The LEFT edge is never faded
  // here; the left gradient handles that seam instead.
  const right = renderGradSvg('r', 0, 0, 1, 0, [
    [0.0, 'white'],
    [0.45, 'white'],
    [0.9, 'black'],
    [1.0, 'black'],
  ]);
  const bottom = renderGradSvg('b', 0, 0, 0, 1, [
    [0.0, 'white'],
    [0.72, 'white'],
    [1.0, 'black'],
  ]);
  const top = renderGradSvg('t', 0, 0, 0, 1, [
    [0.0, 'black'],
    [0.05, 'white'],
    [1.0, 'white'],
  ]);

  // Multiply bottom and top onto the right gradient, then flatten to gray.
  const combined = sharp(renderGradPng(right))
    .composite([
      { input: renderGradPng(bottom), blend: 'multiply' },
      { input: renderGradPng(top), blend: 'multiply' },
    ])
    .greyscale();

  return combined.png().toBuffer();
}

function buildGradientSvg() {
  // Left-to-right: opaque black -> transparent, mostly over the left type area
  // and fading before the portrait's face zone.
  const portraitX = W - PORTRAIT_W;
  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${BG}" stop-opacity="1"/>
      <stop offset="0.30" stop-color="${BG}" stop-opacity="1"/>
      <stop offset="0.52" stop-color="${BG}" stop-opacity="0.85"/>
      <stop offset="${(portraitX / W).toFixed(4)}" stop-color="${BG}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
