# ScriptBank Visual Free

Cloudflare Workers + D1 version of ScriptBank Visual.

## Features

- Public script library
- Client-side filters
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

## Environment variable

- `UPLOAD_PASSWORD`
  - optional
  - default: `kwai666`

## Local dev with Wrangler

```bash
npm install -g wrangler
wrangler dev
```

## Deploy

See `DEPLOY-CLOUDFLARE.md`
