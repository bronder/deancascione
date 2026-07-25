# Dean Cascione — Modern Re-write

A complete visual + technical rewrite of [deancascione.com](https://deancascione.com/),
the personal / EPK site for neoclassical shred guitarist **Dean Cascione**.

Built on the same Astro 7 engine as the [DC Custom Guitars](https://github.com/bronder/dccustomguitars)
refactor, with a distinct **Crimson Metal** identity (blood-red on deep black).

## What's different from the original

| Original | Re-write |
|---|---|
| Single flat `index.html`, inline `<style>` | Astro 7, 9 typed components, semantic HTML |
| No real navigation | Sticky glass nav with smooth-scroll anchors |
| 58 loose `<img>` tags stacked vertically | CSS-columns masonry + keyboard-accessible lightbox |
| Text-link endorsements | Logo grid with hover-lift + grayscale-to-color |
| Bare discography `<ul>` | Year-keyed timeline + 2 embedded YouTube videos |
| mailto only | Web3Forms inquiry form + EPK download + socials |
| Red/green on flat black | Crimson Metal palette + Bebas Neue / Cormorant accents |
| ~257 MB of unoptimized media | 24 MB build, all images auto-compressed to WebP + responsive srcset |

## Stack

- **Astro 7** — static site generator, ships ~zero JS by default
- **TypeScript strict** — type-safe components
- **No CSS framework** — hand-rolled design system in `src/styles/global.css`
- **Google Fonts** — Bebas Neue (display) + Inter (body) + Cormorant Garamond (serif accent)
- **astro:assets** — responsive `<Picture>`/`<Image>` with auto-generated srcset + dimensions

## Local development

Requires Node 22+.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output to dist/
npm run preview  # preview the build
```

## Page structure

```
src/pages/index.astro
└── BaseLayout
    ├── Nav          sticky glass nav · mobile toggle · YouTube/Bookings CTA
    ├── Hero         full-bleed stone-church bg · stats · social icons
    ├── About        biography · pull-quote · portrait
    ├── Music        2 YouTube embeds · discography timeline · free e-book card
    ├── Endorsements 10-brand logo grid (7 logos + 3 text tiles)
    ├── Performances NAMM/Splunk/SENE/Guitar Summit highlights + services
    ├── Gallery      58 photos · masonry · vanilla-JS lightbox (Esc/arrows/backdrop)
    ├── Contact      Web3Forms form + EPK PDF + socials
    └── Footer       brand · nav columns · socials · copyright
```

## Contact form setup

The inquiry form uses [Web3Forms](https://web3forms.com) (free, no backend). To
activate it:

1. Get a free access key at web3forms.com (it sends submissions to
   `dean@deancascione.com`).
2. Paste the key into `src/components/Contact.astro`, replacing
   `YOUR_WEB3FORMS_ACCESS_KEY`.

Until then, the mailto link and EPK download work standalone.

## Downloads (e-book + audio)

The 100+ page instructional e-book and 20 lesson MP3s (~120 MB) stay hosted on
the existing `deancascione.com/ebook/` paths and are linked externally, keeping
this repo light. To localize them later, copy the files into `public/downloads/`
and update the two URLs in `src/components/Music.astro`.

## Deployment

Two pipelines run on every push to `main` (mirrors the DC Custom Guitars setup):

| Target | Workflow | URL |
|---|---|---|
| GitHub Pages (staging/backup) | `deploy.yml` | `https://<owner>.github.io/<repo>/` |
| Dean's host via SFTP (production) | `deploy-sftp.yml` | `https://deancascione.com/<BASE_PATH>/` |

### GitHub Pages

Derives `SITE_URL` / `BASE_PATH` from the repo by default. No config needed for
the staging mirror.

### SFTP to deancascione.com

Add in **Settings → Secrets and variables → Actions**:

**Secrets:** `SFTP_HOST`, `SFTP_USER`, `SFTP_PASSWORD`, `SFTP_PORT` (optional, default 2222)
**Variables:** `SITE_URL`, `BASE_PATH` (staging: `/new`), `SFTP_TARGET`

The staging build previews at `deancascione.com/new/` while the existing site
keeps serving from the document root. To go live, flip `BASE_PATH` → `/` and
`SFTP_TARGET` → document root.

> The workflow refuses to deploy if `SFTP_TARGET` is `/` — a safety guard so
> `lftp --delete` can never wipe the live site by accident.

## SEO

- `MusicGroup` structured data (schema.org) with `sameAs` social links, genre,
  and `album`/`track` entries for the discography
- Canonical `https://deancascione.com`, auto sitemap, dynamic `robots.txt`
- `og-hero.jpg` stable Open Graph image

## Structure

```
src/
├── assets/images/    hero, portrait, e-book cover
│   ├── endorsements/ 7 brand logos
│   └── gallery/      58 performance photos
├── components/       Nav, Hero, About, Music, Endorsements, Performances, Gallery, Contact, Footer
├── layouts/          BaseLayout (SEO meta, MusicGroup schema)
├── pages/            index.astro, robots.txt.ts
└── styles/           global.css (Crimson Metal design system)
public/
├── epk/              Electronic Press Kit PDF
└── favicon, icons, og-hero, manifest
.github/workflows/    deploy.yml (Pages), deploy-sftp.yml (SFTP), ci.yml
```
