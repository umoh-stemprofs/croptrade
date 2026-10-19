# CropTrade — Agriculture rules checklist

Every line from 00-global.md section 1 ("Agro-Analytics" Farm Dashboard), proved against
where it lives in the app. Verified by a full click-through on the dev server (port 3200).

Legend: **PASS** = present and verified in the browser · **MISSING** = not present.

| # | Rule (00-global §1) | Where it is in CropTrade | Status |
|---|---|---|---|
| 1 | Prices for at least 3 crops from an API or a simulated live feed | 9-crop catalog in `lib/market/catalog.ts` (Maize, Cassava, Yam, Rice, Tomato, Tilapia, Catfish, Eggs, Palm oil). `SimulatedProvider` (default) or `LiveProvider` when `MARKET_API_URL` is set (`lib/market/provider.ts`). Shown on the Market page as one card per crop | PASS |
| 2 | Weather forecast for the farm's own coordinates, from a weather API | `lib/weather/getWeather.ts` → Open-Meteo (no key) or OpenWeatherMap (`OWM_API_KEY`). Reads the farm's own `lat`/`lon` (`lib/farm.ts`), falls back to Port Harcourt when the lookup fails. Weather page shows "Farm coordinates: 4.8156, 7.0498" | PASS |
| 3 | Inventory + "Estimated Market Value" of stock from current prices | Stock page (`app/(app)/stock/page.tsx`) + `lib/inventory.ts` (`totalStockValueKobo`). Dashboard "Total stock value" card = Σ qtyKg × today's price (integer kobo) | PASS |
| 4 | At least one external fetch that works, shown on screen | Exchange rates from `https://open.er-api.com/v6/latest/USD` (`lib/fx/rates.ts`), weather from Open-Meteo. Both server-side, shown on the dashboard with a **Live** badge. Verified live in the browser | PASS |
| 5 | Line, bar or pie charts for inventory and market trends | Recharts in `components/charts/`. Dashboard: bar "Stock value by crop" + pie "Share of stock value". Market: price line 7/30/90 days. Rates: 30-day line. Valuations: net-value bars. Each has a "View as table" equivalent | PASS |
| 6 | Responsive (phone to desktop) | Tailwind breakpoints. Verified at 350px (bottom nav + single column) and 1280px (left sidebar + 12-column grid), design.md §3 | PASS |
| 7 | API keys in environment variables only | `OWM_API_KEY`, `DATABASE_URL`, `SESSION_SECRET`, `MARKET_API_URL` all read from `process.env` (`.env`, git-ignored). None shipped to the browser; all fetches are server-side. `.env` is git-ignored (`.gitignore` line 2) | PASS |
| 8 | Every data block labeled Live, Saved data or Simulated | `components/DataSourceBadge.tsx` — color + icon + word, never color alone. Applied to every stat card, rate card, price card, weather card, chart and export (Live · Saved data · Simulated · Manual). Verified on dashboard, rates, market, weather, valuations | PASS |
| 9 | Disclaimer: "Decision-support tool. You decide." | Footer on every app page, e.g. "Decision-support tool. You decide. Sample prices are placeholders." (verified in browser) | PASS |

## Extra checks from the brief

| Check | Where | Status |
|---|---|---|
| Every data card shows Live / Saved data / Simulated / Manual | `DataSourceBadge` + `rateRowBadge` (`components/dashboard/Cards.tsx`) | PASS |
| Page says "Decision-support tool. You decide." | Footer component on every page | PASS |
| Exchange-rate source shown | "Rates By Exchange Rate API" attribution link on the Rates card and Rates page (`FX_ATTRIBUTION`) | PASS |
| Wrong password → one sentence, no crash | `lib/actions/auth.ts` + `lib/errors.ts`; verified in browser | PASS |
| Stock quantity of 0 rejected | `lib/inventory.ts` Zod check; `lib/inventory.test.ts` "qty 0 rejected" | PASS |
| Rate of 0 rejected | `lib/export.ts` + `lib/fx/manual.ts`; blocked client-side (HTML `min`) and server-side (Zod). Verified in browser | PASS |
| Missing-rate currency → link to Rates page, no crash | `lib/export.ts` `kind: "no-rate"` → wizard sends to `/rates?missing=QUOTE` | PASS |
| Weather call failing → last snapshot "Saved data" badge, else error card + Retry | `lib/weather/getWeather.ts`; test `getWeather.test.ts` "returns the last snapshot with the Saved data badge when the call fails" | PASS |
| Exchange-rate call failing → last saved rate "Saved data" badge | `lib/fx/service.ts`; test `fx/store.test.ts` "falls back to the last saved rate with Saved data when the call fails" | PASS |
| Nothing crashes or shows a raw error | Every server action re-checks the session, every external call has a one-sentence fallback. Verified across all pages and the two failure modes above | PASS |

## Bugs found and fixed during the click-through

1. **Inline stock edit form stayed open after saving** (`components/stock/EditStockButton.tsx`).
   After a successful save the action redirected back to `/stock`, but the client `open`
   state survived the soft navigation, so the row kept showing the edit form. Fixed by
   closing the form when the action settles.

## Nothing marked MISSING

All nine Agriculture rules and every extra check are present and verified.
