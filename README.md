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

All prices and FX rates are **Simulated** until an optional live source is configured.
Badges on every card say `Live`, `Saved data`, `Simulated` or `Manual`.
A manual rate is stored per farm (`ManualRate`), never in the shared FX table, so one
farmer's override cannot change another farmer's rate. "Use live rate again" removes it.

## Progress

- [x] Step 1 — schema + seed
- [x] Step 2 — market + weather + FX adapter with fallback tests (routes, home cards, docs/api.md)
- [x] Step 3 — export.ts + tests (weather keeps working when the database is down)
- [x] Step 4A — auth (iron-session + bcrypt), dashboard shell, stock, market, weather, settings
- [x] Step 4B — valuation wizard, saved valuations, Rates pages (per-farm manual rates)
- [ ] Step 5 — charts
- [ ] Step 6 — click-through

## Notices

Sample numbers (prices, rates, thresholds) are PLACEHOLDERS — an expert must review
them before any real use. Decision-support tool. You decide.
