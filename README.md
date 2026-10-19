# CropTrade — what is my crop worth abroad?

STEM Festival 2026 · Agriculture track · Accent `#00796B`

Turns farm stock into export value using the market price and a live exchange rate
(with a saved fallback and a manual override), and finds the next dry loading window
from the weather forecast.

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind · Prisma + hosted Neon Postgres ·
Recharts · Zod · iron-session · bcryptjs · date-fns-tz · Vitest

## Setup

```bash
npm install
cp .env.example .env   # then fill DATABASE_URL and SESSION_SECRET
npx prisma migrate deploy   # create tables from prisma/migrations
npm run db:seed        # seed demo data
npm run dev            # http://localhost:3200
```

## Commands

```bash
npm run dev        # dev server → http://localhost:3200
npm test           # unit tests (vitest)
npm run build      # production build
npm run db:seed    # seed demo data — idempotent, safe to re-run
npx prisma migrate deploy   # apply committed migrations
```

## Environment variables (.env — git-ignored, never commit)

| Key | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres connection string |
| `SESSION_SECRET` | yes | session cookie encryption (iron-session), 32+ random characters |
| `MARKET_API_URL` | no | if set, live market price endpoint (falls back to the simulated feed) |
| `OWM_API_KEY` | no | OpenWeatherMap key; empty = Open-Meteo (no key) |
| `DEMO_MODE` | no | `true` shows the "Try demo account" button on the login page |

## Demo account (README only)

- Email: `farmer@demo.local`
- Password: `croptrade123`

## Data labelling

Every data card is badged `Live`, `Saved data`, `Simulated` or `Manual` (color + icon +
word, never color alone). Exchange rates and weather are fetched **live** from the server;
market prices are **simulated** by default (set `MARKET_API_URL` for a live feed). A manual
rate is stored per farm (`ManualRate`), never in the shared FX table, so one farmer's
override cannot change another farmer's rate. "Use live rate again" removes it.

## Charts

Recharts with colour-blind safe series colours, max 6 series, pie max 5 slices (the
rest are grouped as "Other"). Every chart card has the data-source badge, a "View as
table" link with exactly the same numbers, an empty state (icon, sentence, button)
and a loading skeleton.

- **Dashboard** — stock value by crop (bar, naira) and share of stock value (pie).
- **Rates** — 30-day line chart with a USD / EUR / GBP switch. Days with no saved
  rate are gaps, never invented; the tooltip names each point's source.
- **Market** — one crop's price over 7, 30 or 90 days.
- **Valuations** — net export value per saved valuation, one currency at a time
  (currencies are never added together).

## Demo states in the seed

`npm run db:seed` is idempotent and sets up every state a judge should see:

- **Manual + Old rate** — the demo farm has a ₦1,850 GBP rate set 10 days ago.
- **Saved data + Old rate + gaps** — EUR's saved history ends 10 days ago, so the
  fallback shows saved data with real gaps until a live rate arrives.
- **Live / Simulated** — USD keeps 30 days of history, and the live fetch replaces a
  simulated rate on the day it succeeds.

Because a live rate legitimately replaces the saved one, the `Saved data` badge shows
whenever the live source cannot be reached (that is the fallback path).

## Progress

- [x] Step 1 — schema + seed
- [x] Step 2 — market + weather + FX adapter with fallback tests (routes, home cards, docs/api.md)
- [x] Step 3 — export.ts + tests (weather keeps working when the database is down)
- [x] Step 4A — auth (iron-session + bcrypt), dashboard shell, stock, market, weather, settings
- [x] Step 4B — valuation wizard, saved valuations, Rates pages (per-farm manual rates)
- [x] Step 5 — charts (bar, pie, line) with table views, empty states, skeletons and demo states
- [x] Step 6 — full click-through, fixes, rules checklist, submission + hosting docs

## Docs

- `docs/api.md` — every external call, URL pattern, key name, sample response, fallback
- `docs/rules-checklist.md` — every Agriculture rule (00-global §1) proved against the app
- `docs/submission.md` — task overview, demo script, report outline, submission checklist
- `docs/hosting.md` — Vercel + Neon: env names, build command, migrations, demo password

## Notices

Sample numbers (prices, rates, thresholds) are PLACEHOLDERS — an expert must review
them before any real use. Decision-support tool. You decide.
