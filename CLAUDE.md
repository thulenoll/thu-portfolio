# Thu LeNoll — Portfolio

A static portfolio website built on Thu LeNoll's Claude Design system (cream paper
background, periwinkle + terra accents, Literata + Manrope + JetBrains Mono, editorial
voice). No framework, no build step — plain HTML/CSS/JS.

## Entry point & structure
- **`index.html`** — the homepage / work index (originally `Homepage.html`; renamed so `/`
  resolves on Netlify). All internal links point to `index.html`.
- Case-study pages are top-level `*.html` files (e.g. `JSQ Product Viz Case Study.html`,
  `DSLeague Case Study.html`, `Daiverse Case Study.html`).
- **`design-system.css`** — shared tokens (4pt spacing scale, colors, type). Some pages
  inline their tokens rather than linking this; see the design system's `README.md`.
- **`assets/`** — per-project images/gifs/video. Other media dirs: `_frames/`, `preview/`,
  `screenshots/`, `uploads/`, `.thumbnail/`.

## CRITICAL: always preview over HTTP, never file://
YouTube embeds, local `.mp4` videos, and the live-page `<iframe>` on the JSQ Product Viz
page all break when opened as a `file://` document (YouTube "Error 153", blank embed).
They only work when served over `http`/`https`.

```bash
cd "/Users/tle/Thu's PF 2026"
python3 -m http.server 8137
# → open http://localhost:8137/  (Ctrl-C to stop)
```

## Deploy: continuous from GitHub → Netlify
- Remote: `https://github.com/thulenoll/thu-portfolio.git` (branch `main`).
- **Netlify auto-deploys on every push to `main`** — a push goes live in ~1–2 min.
- `netlify.toml` sets publish dir `.` with no build command. Do not add a build step.
- For risky changes: branch + PR → Netlify creates a deploy-preview URL → merge to go live.

## Conventions
- Snap spacing to the 4pt scale (`--s-1`…`--s-32`). Hairlines, not borders. No drop shadows.
  No emoji. Italics (`<em>`) mark the *idea* word, not for bold emphasis.
- Filenames are case-sensitive on Netlify (Linux) but not on macOS — match case exactly in
  links, or it 404s only in production.
- Commit messages: short and descriptive. Commit small and often.

## Not in git
`.claude/` (session config) and `.DS_Store` are gitignored — leave them out of commits.
