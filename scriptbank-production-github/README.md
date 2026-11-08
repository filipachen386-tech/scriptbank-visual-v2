# ScriptBank Visual Free

Cloudflare Workers + D1 version of ScriptBank Visual.

## Features

- Public script library
- Client-side filters
- Cascading grande tema and theme-label filters
- Concise Portuguese theme labels with legacy-label import migration
- Sixteen normalized principal-persona filters
- Weighted-score descending ordering across all filtered views
- Password-protected admin panel
- Markdown import using `# SCRIPT 1` format
- JSON import from existing `script_library.json`
- Delete single script
- Free-friendly deployment path on Cloudflare

## Files

- `wrangler.toml`
- `src/worker.js`
- `public/index.html`
- `public/app.js`
- `dist/scripts-classified.json`
- `dist/classification-audit.csv`
- `dist/review-required.csv`

## Environment variable

- `UPLOAD_PASSWORD`
  - optional
  - default: `kwai666`

## Classified dataset

The local working set contains 140 scripts from Agosto, Setembro, Outubro and Novembro. Each script has one `grand_theme`, one `theme_label` and one principal `persona`. The original content, timeline and source URL are unchanged.

`dist/review-required.csv` contains the original mappings and classifications selected for review. `L` weighted scores are stored as `weighted_score` in the classified dataset and preview D1.

The 25 concise labels come from the approved `theme-label-migration.json` mapping. JSON and Markdown imports using the former long labels are normalized automatically. Only `theme_label` text changes; theme assignment, personas, weighted scores and script content stay unchanged.

## Ordering

Scripts are ordered by weighted score descending, then upload time descending, then script ID ascending. The same comparator is applied after keyword, bookmark, month, theme, theme-label, persona and category filters. Missing scores default to zero.

## Local dev with Wrangler

```bash
npm install -g wrangler 
wrangler dev
```

## Deploy

See `DEPLOY-CLOUDFLARE.md`
