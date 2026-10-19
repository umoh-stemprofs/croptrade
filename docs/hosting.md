# CropTrade — hosting on Vercel + Neon

How to put the app online for the judges. The database is hosted **Neon** Postgres
(never a local Postgres — see 00-global §0). No Docker, no system installs.

## 1. Environment variables to set in Vercel

Set these in Vercel → Project → Settings → Environment Variables. **Names only —
never put the real values in a file or in git.** Copy the values from your local
`.env`; do not commit them and do not paste them into a document.

| Name | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | Your Neon Postgres connection string (from the Neon dashboard) |
| `SESSION_SECRET` | yes | 32+ random characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DEMO_MODE` | yes (for the demo) | `true` — see section 4 |
| `OWM_API_KEY` | no | OpenWeatherMap key. Leave empty to use Open-Meteo (no key) — this is the default |
| `MARKET_API_URL` | no | Leave empty — the app uses its built-in simulated price feed |

`.env` is git-ignored (first line of `.gitignore`). `.env.example` holds the names and
placeholder comments only — commit that, never `.env`.

## 2. Build command and output

- **Framework preset:** Next.js (Vercel detects it automatically)
- **Build command:** `npm run build` (runs `next build`)
- **Output:** Next.js default (Vercel handles it)
- **Install command:** `npm install`
- **Node version:** 18 or newer

## 3. Where migrations run

Migrations are committed in `prisma/migrations/` and are applied to the **Neon database**
with a **release command**, not during the build:

- **Release command:** `npx prisma migrate deploy`
- This runs `prisma migrate deploy` against `DATABASE_URL` (Neon) on each deploy, creating
  any tables the committed migrations describe. It is idempotent — already-applied
  migrations are skipped.

`prisma migrate deploy` (not `db push`) is the right command in production because it
replays the committed migration history in order. After the first deploy, seed the demo
account once by running locally against the same `DATABASE_URL`:

```bash
npm run db:seed
```

(Seeding is idempotent and safe to re-run.)

## 4. What to set DEMO_MODE to for the judges

Set `DEMO_MODE=true`.

With `true`, the login page shows a **"Try demo account"** button that signs the judge
into the seeded demo farm with one click — no typing. Set it to `false` (or remove it)
for a private production deployment where you do not want anyone reaching the demo data.

## 5. Use a stronger demo password on the hosted site

The seeded demo password in `prisma/seed.ts` / `README.md` is a placeholder and is fine
for a closed-room demo, but **change it before the site is public**. The demo account
(`farmer@demo.local`) is shared and its credentials are printed in the README, so anyone
who can reach the hosted URL can log into that farm.

To harden it: edit `DEMO_PASSWORD` in `prisma/seed.ts` to a strong random password, run
`npm run db:seed` again against the Neon database, and put the new password somewhere
judges can read it (a slide or the demo doc) instead of in the public README. Better
still, for a public link set `DEMO_MODE=false` and give judges their own sign-up.

## 6. Anything that only works on localhost

None. Verified by search across the whole app:

- No `localhost`, `127.0.0.1`, `0.0.0.0` or hard-coded `:3200` URL appears in any source
  file — the only match is the `npm run dev` hint comment in `README.md`.
- All external calls (FX, weather, optional market feed) are made server-side to public
  `https://` endpoints, read from environment variables.
- The session cookie is `httpOnly`, `sameSite=lax`, and `secure` automatically in
  production (`lib/session.ts` sets `secure: process.env.NODE_ENV === "production"`), so
  it works on the Vercel `https://` domain.
- The app binds no fixed port; `next dev`/`next start` take `-p`, and Vercel provides the
  port in production.
