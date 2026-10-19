# CropTrade — submission kit

STEM Festival 2026 · Agriculture track ("Agro-Analytics" Farm Dashboard) ·
App: **CropTrade** · Accent `#00796B`

Email subject when submitting: `SEN_Coding_AgroAnalytics_<TeamName>_CropTrade`
to senior@stemfestival.org (00-global §7).

## 1. Task overview (one page)

**What it does.** CropTrade answers one farmer's question: *what is my crop worth
abroad?* A farmer keeps their stock (kg of maize, catfish, tomato, …). The app prices
that stock at today's market price, converts it to a foreign currency at a live exchange
rate, subtracts an export cost, and shows the net export value. It also finds the next
dry loading window from the weather forecast so the farmer knows the best day to ship.

**Data sources (Live vs Simulated).**
- **Exchange rates — LIVE.** Fetched server-side from `open.er-api.com` (free, no key),
  cached 6 hours, Zod-validated. Shown with the "Rates By Exchange Rate API" attribution.
  On failure it falls back to the last saved rate with a "Saved data" badge; a rate older
  than 7 days also gets an orange "Old rate" tag but still calculates. A farmer can type a
  manual rate (badge "Manual"), which is stored per farm and never leaks to another farm.
- **Weather — LIVE.** Open-Meteo (no key) by default, or OpenWeatherMap when
  `OWM_API_KEY` is set. Cached 30 minutes in `WeatherSnapshot`; on failure the last
  snapshot shows as "Saved data · 3 h old".
- **Market prices — SIMULATED** by default (a deterministic generated feed, so the same
  date always gives the same price and the demo always shows a riser and a faller). If
  `MARKET_API_URL` is set, a live feed is used and falls back to simulated on failure.
  Every card's badge always shows the true source.

**The key formula (pure, in `lib/export.ts`, unit-tested).**

```
totalLocal      = qtyKg × localPricePerKg          (integer kobo: ₦1 = 100 kobo)
grossForeign    = totalLocal / localPerForeign      (2 decimals)
netForeign      = grossForeign × (1 − exportCostPct / 100)
localPerForeign = rates[NGN] / rates[quote]         ("1 foreign = X naira")
```

`qty > 0` and `rate > 0` are required, else a one-sentence error. Best day to sell
abroad = highest rate in the last 30 days vs today. Loading window = first of the next
5 forecast days with rain < 5 mm.

## 2. Demo script (5–7 min) — Agriculture

1. **Login.** Show the login page, then click **"Try demo account"** (`DEMO_MODE=true`)
   to land in the seeded demo farm. (Also show a wrong password → one plain sentence.)
2. **Dashboard.** 4 stat cards (stock value in ₦, same value in USD, today's USD rate,
   next loading window), weather card, maize price card, rates card — every card with its
   Live / Saved data / Simulated badge. Bar + pie charts of stock value.
3. **Show the live API call.** Open the browser network tab and reload: point at the
   server-side fetch to `open.er-api.com` returning real rates, and to Open-Meteo
   returning the forecast. Both are labelled **Live** on screen.
4. **Stock.** Add stock, then edit it and delete it (confirm dialog). The "Total stock
   value" and the charts update.
5. **Work out value.** Run the wizard: pick a crop from stock, a kg amount, then a
   currency (USD / EUR / GBP — three cards with code and rate) and an export cost %. The
   result screen shows the huge export value, the ₦ total, the rate + date + source badge,
   the orange "Old rate" tag when relevant, and the rate trend sparkline.
6. **Save** the valuation, then show it in the **Valuations** list with totals (currencies
   never added together) and delete one.
7. **Rates + manual override.** On Rates, click **Change** on a currency, type a manual
   rate (badge becomes "Manual"), then **"Use live rate again"** to clear it. Show the
   30-day rate line chart with the USD/EUR/GBP switch.
8. **Charts + feature.** Market page (price line 7/30/90 days, change since yesterday,
   "View as table"), Weather page (current, 5-day forecast, dry loading window).
9. **Honesty.** Point at the "Decision-support tool. You decide." footer and the
   "Sample prices are placeholders" note, and at every data-source badge.

## 3. Report outline (4–8 pages) — Agriculture

1. **Introduction & problem** — the export-value gap for smallholder farmers.
2. **What it does** — features, screens, the key formula (above).
3. **API documentation** — see `docs/api.md`: every external call, URL pattern, key
   name, sample response, fallback behaviour.
4. **Database schema** — `prisma/schema.prisma`: User, Farm, InventoryItem, PriceTick,
   WeatherSnapshot, FxTick, ManualRate, Valuation, Settings. Money as integer kobo.
5. **How it improves profit** — turns "guess the price" into a dated net export number,
   flags when today's rate is below the 30-day best, and picks a dry loading day.
6. **Data honesty** — which sources are Live vs Simulated; every card is badged.
7. **Limits & honest notes** — sample numbers are PLACEHOLDERS requiring expert review;
   market feed is simulated by default; the app is decision-support, not advice.

## 4. Submission checklist (00-global §7)

- [ ] Task overview (section 1 above)
- [ ] Demo video 5–7 min (script in section 2)
- [ ] Report 4–8 pages (outline in section 3; cite `docs/api.md` + `docs/rules-checklist.md`)
- [ ] Hosted link (see `docs/hosting.md`) + repository link
- [ ] README with setup, env variables, demo account, commands, port
- [ ] Email subject `SEN_Coding_AgroAnalytics_<TeamName>_CropTrade` to senior@stemfestival.org

## 5. Related files

- `docs/api.md` — every external call, URL pattern, key name, sample response
- `docs/hosting.md` — Vercel + Neon, env names, build command, migrations, demo password
- `docs/rules-checklist.md` — every Agriculture rule proved against the app
- `README.md` — setup, env variables, demo account, commands, port
