# LIVE SCORE LINETOGEL — Cloudflare Worker

Arsitektur tanpa plugin WordPress:

- `public/` = UI LIVE SCORE LINETOGEL.
- `src/index.js` = API aggregator + cache High Traffic Mode.
- `wrangler.jsonc` = konfigurasi Cloudflare Worker + Static Assets.

## Deploy

Repository ini dirancang untuk Cloudflare Workers Builds.

- Build command: kosong
- Deploy command: `npx wrangler deploy`
- Production branch: `main`

## Secret opsional

Jika memiliki API key football-data.org, tambahkan secret Cloudflare:

`FOOTBALL_DATA_KEY`

Tanpa secret tersebut, Football tetap mencoba sumber lain yang tidak memerlukan key.

## Endpoint

`/api/scores?sport=football`

Sport yang didukung:

- football
- hockey
- basketball
- tennis
- cricket
