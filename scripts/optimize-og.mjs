/**
 * optimize-og.mjs
 *
 * Converts the master share image (public/og-hero-2026.png) into an
 * optimized, social-scraper-friendly JPG for delivery:
 *   - flattened onto brand black (alpha -> black; harmless when already opaque)
 *   - resized to 2400x1260 (2x the 1200x630 OG spec for retina sharpness;
 *     aspect 1.904 ~= ideal 1.909, so previews aren't letterboxed)
 *   - progressive JPG, quality 85, 4:2:0 chroma -> ~200-300 KB
 *
 * Why a separate JPG instead of shipping the PNG:
 *   Facebook caps OG images at 8 MB, Twitter at ~5 MB, and Slack/iMessage
 *   frequently time out on multi-MB images. The 7.8 MB source reliably
 *   produces slow or missing previews; this JPG renders everywhere and
 *   fast. The PNG remains the editable source of truth.
 *
 * The site references the .jpg (see BaseLayout.astro), so no code change is
 * needed when the PNG is re-edited — just re-run this script.
 *
 * Run:  node scripts/optimize-og.mjs
 */

import sharp from 'sharp';
import { statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SRC = resolve(ROOT, 'public/og-hero-2026.png'); // master (editable)
const OUT = resolve(ROOT, 'public/og-hero-2026.jpg'); // delivered
const BG = '#0a0a0a'; // brand black; alpha is flattened onto this

const OUT_W = 2400;
const OUT_H = 1260;

async function main() {
  const before = (await sharp(SRC).metadata());
  console.log(`Source: ${before.width}x${before.height} ${before.format}`);

  await sharp(SRC)
    .flatten({ background: BG })           // alpha -> solid bg
    .resize(OUT_W, OUT_H, {
      fit: 'cover',
      position: 'centre',                  // both axes near-identical ratio
    })
    .jpeg({ quality: 85, progressive: true, chromaSubsampling: '4:2:0' })
    .toFile(OUT);

  const after = (await sharp(OUT).metadata());
  const kb = (statSync(OUT).size / 1024).toFixed(0);
  console.log(`✓ Wrote public/og-hero-2026.jpg  ${after.width}x${after.height}  ~${kb} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
