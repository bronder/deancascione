import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Production is the canonical deployment (deancascione.com). GitHub Pages
// acts as a mirror/staging URL — override via env if needed:
//   SITE_URL=https://bronder.github.io/deancascione BASE_PATH=/deancascione
const site = process.env.SITE_URL ?? 'https://deancascione.com';
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site,
  base,
  compressHTML: true,
  integrations: [sitemap()],
  image: {
    // Auto-generate responsive srcset + dimensions for all <Image>/<Picture>.
    // 'constrained' = max-width:100%, scales down on smaller viewports.
    layout: 'constrained',
    responsiveStyles: true,
  },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      cssCodeSplit: true,
    },
  },
});
