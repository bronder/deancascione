/**
 * generate-favicons.mjs
 *
 * Rasterizes public/favicon.svg (the "DC" monogram on a red tile) into the
 * full set of PNG favicons / touch icons / PWA icons used by the site, so
 * every output is a crisp, on-brand vector render instead of a downscaled
 * photograph (which is what previously turned to mud at small sizes).
 *
 * Outputs (all written to public/):
 *   favicon-32.png          32x32   (browser tab)
 *   apple-touch-icon.png    180x180 (iOS home screen / Safari pinned)
 *   icon-192.png            192x192 (PWA manifest)
 *   icon-512.png            512x512 (PWA manifest / splash)
 *   icon-maskable-512.png   512x512 (Android adaptive icon, safe-zone padded)
 *
 * Rendering uses 2x supersampling then downscale for anti-aliasing quality.
 * The maskable variant adds internal padding so the "DC" stays inside the
 * Android safe zone (~80% center area) regardless of device mask shape.
 *
 * Run:  node scripts/generate-favicons.mjs
 */

import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Build a multi-resolution .ico (PNG-encoded entries) from the "DC" SVG.
 * Modern browsers accept PNG entries inside ICO, which avoids a separate
 * BMP encoder. We embed 48, 32, and 16 — the conventional tab sizes.
 */
async function buildIco(svg) {
  const sizes = [48, 32, 16];
  const pngs = [];
  for (const s of sizes) {
    pngs.push({ size: s, data: await renderToPng(svg, s) });
  }
  const headerSize = 6 + pngs.length * 16;
  let offset = headerSize;
  const entries = pngs.map((p) => {
    const e = {
      size: p.size,
      width: p.size >= 256 ? 0 : p.size,
      data: p.data,
      offset,
    };
    offset += p.data.length;
    return e;
  });
  // ICONDIR header (6 bytes) + ICONDIRENTRY (16 bytes each) + PNG data
  const total = offset;
  const buf = Buffer.alloc(total);
  let o = 0;
  buf.writeUInt16LE(0, o); (o += 2);          // reserved
  buf.writeUInt16LE(1, o); (o += 2);          // type = ICO
  buf.writeUInt16LE(entries.length, o); (o += 2);
  for (const e of entries) {
    buf.writeUInt8(e.width, o); (o += 1);
    buf.writeUInt8(e.width, o); (o += 1);     // height == width
    buf.writeUInt8(0, o); (o += 1);           // palette
    buf.writeUInt8(0, o); (o += 1);           // reserved
    buf.writeUInt16LE(1, o); (o += 2);        // color planes
    buf.writeUInt16LE(32, o); (o += 2);       // bits per pixel
    buf.writeUInt32LE(e.data.length, o); (o += 4);
    buf.writeUInt32LE(e.offset, o); (o += 4);
  }
  for (const e of entries) {
    e.data.copy(buf, e.offset);
  }
  return buf;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SVG_PATH = resolve(ROOT, 'public/favicon.svg');
const OUT_DIR = resolve(ROOT, 'public');

// ---- Brand tokens (must match favicon.svg / global.css) -------------------
const BG = '#0a0a0a';
const ACCENT = '#c8102e';
const INK = '#0a0a0a';

const SUPER = 2; // supersample factor for AA quality

const SIZES = [
  { file: 'favicon-32.png', size: 32, maskable: false },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
];

const baseSvg = readFileSync(SVG_PATH, 'utf8');

function renderToPng(svg, px) {
  // Render at SUPER*px, then downscale to px for crisp anti-aliasing.
  const renderPx = px * SUPER;
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: renderPx },
    background: BG,
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'Arial',
    },
  });
  const bigPng = resvg.render().asPng();
  return sharp(bigPng).resize(px, px, { fit: 'cover' }).png().toBuffer();
}

function makeMaskableSvg(px) {
  // Android "maskable" icons can be clipped to any shape (circle, squircle,
  // rounded square) by the device. The "safe zone" is the center ~80%.
  // We build a dedicated SVG: full-bleed red tile + black frame, with the
  // "DC" scaled into the center safe zone so it is never clipped.
  const safe = px * 0.80;       // safe-zone square side
  const pad = (px - safe) / 2;  // equal padding all sides
  const fontSize = safe * 0.46; // DC fills ~46% of the safe zone
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" role="img" aria-label="Dean Cascione">
  <rect width="${px}" height="${px}" fill="${ACCENT}"/>
  <text x="${px / 2}" y="${px / 2 + fontSize * 0.36}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="800"
        font-size="${fontSize.toFixed(1)}" fill="${INK}"
        letter-spacing="${(fontSize * 0.04).toFixed(2)}">DC</text>
</svg>`;
}

async function main() {
  console.log('Source SVG: public/favicon.svg');
  for (const { file, size, maskable } of SIZES) {
    const svg = maskable ? makeMaskableSvg(size * SUPER) : baseSvg;
    const buf = await renderToPng(svg, size);
    const outPath = resolve(OUT_DIR, file);
    writeFileSync(outPath, buf);
    console.log(`  ✓ ${file}  ${size}x${size}${maskable ? '  (maskable)' : ''}`);
  }
  // Multi-resolution .ico fallback (older browsers + some link previewers).
  const ico = await buildIco(baseSvg);
  writeFileSync(resolve(OUT_DIR, 'favicon.ico'), ico);
  console.log('  ✓ favicon.ico  16+32+48 (multi-res)');
  console.log('\nDone. 6 icons written to public/.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
