# CropTrade API documentation

Every external call the app makes, plus the routes the app serves itself.
All external calls happen **on the server only** (never in the browser), with a
5 s timeout and one retry. Responses from external services are validated with
Zod; anything unexpected is rejected and the app falls back or shows an error card.

## Environment keys

| Key | Required | Used for |
|---|---|---|
| `DATABASE_URL` | yes | hosted Neon Postgres (Prisma, `postgresql` provider) |
| `OWM_API_KEY` | no | OpenWeatherMap; when empty the app uses Open-Meteo (no key) |
| `MARKET_API_URL` | no | optional live crop-price feed; when empty the simulated feed is used |

## External calls

### 1. Exchange rates — open.er-api.com (ExchangeRate-API “open access”)

- **URL pattern**: `https://open.er-api.com/v6/latest/USD`
- **Key name**: none (free, no API key)
- **Method / caching**: GET, server-side, 6-hour in-memory cache; each rate is saved to
  the `FxTick` table with `source = LIVE` (a LIVE value may replace a SIMULATED tick for
  the same date, but **never** a MANUAL one)
- **Rate meaning**: “1 foreign = X local”; computed as `localPerForeign = rates[NGN] / rates[quote]`
  from this USD-based table (currencies: USD, EUR, GBP)
- **Fallback**: on failure use the last saved `FxTick` with the “Saved data” badge;
  a saved rate older than 7 days also gets the orange “Old rate” tag (it still calculates);
  no rate at all → one-sentence error on the card, no crash
- **Terms**: free for personal/commercial end use, **attribution required**
  (“Rates By Exchange Rate API”, shown on the home page), no redistribution —
  rates are displayed to the end user only, never re-served as an API
- **Docs**: https://www.exchangerate-api.com/docs/free · https://www.exchangerate-api.com/terms
- **Sample response** (2026-10-18):

```json
{
  "result": "success",
  "provider": "https://www.exchangerate-api.com",
  "documentation": "https://www.exchangerate-api.com/docs/free",
  "terms_of_use": "https://www.exchangerate-api.com/terms",
  "time_last_update_unix": 1792281751,
  "time_last_update_utc": "Sun, 18 Oct 2026 00:02:31 +0000",
  "base_code": "USD",
  "rates": { "USD": 1, "EUR": 0.889614, "GBP": 0.750845, "NGN": 1490.71 }
}
```

### 2. Weather — Open-Meteo (default, no key)

- **URL pattern**:
  `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max&timezone=Africa/Lagos&forecast_days=5`
- **Key name**: none
- **Method / caching**: GET, server-side, cached in the `WeatherSnapshot` table for 30 minutes
- **Fallback**: on failure the last `WeatherSnapshot` is shown with the “Saved data · 3 h old”
  badge; with no snapshot → error card with a Retry button; the rest of the app keeps working
- **Docs**: https://open-meteo.com/en/docs
- **Sample response** (shape we use):

```json
{
  "current": {
    "time": "2026-10-18T12:00",
    "temperature_2m": 30.5,
    "relative_humidity_2m": 80,
    "weather_code": 2,
    "wind_speed_10m": 12
  },
  "daily": {
    "time": ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"],
    "weather_code": [2, 3, 61, 0, 1],
    "temperature_2m_min": [24, 24, 23, 24, 25],
    "temperature_2m_max": [31, 30, 29, 32, 33],
    "precipitation_sum": [0, 0.4, 12, 0, 0],
    "precipitation_probability_max": [10, 20, 80, 5, 10]
  }
}
```

### 3. Weather — OpenWeatherMap (only when OWM_API_KEY is set)

- **URL pattern**: `https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={KEY}&units=metric`
- **Key name**: `OWM_API_KEY` (env only, never committed, never sent to the browser)
- **Method / caching**: GET, server-side, same 30-minute `WeatherSnapshot` cache;
  the 3-hour list is folded into 5 daily entries (min/max °C, rain mm, max chance %)
- **Fallback**: identical to Open-Meteo
- **Docs**: https://openweathermap.org/forecast5
- **Sample item** (shape we use):

```json
{
  "list": [
    {
      "dt": 1790856000,
      "main": { "temp": 30.1, "temp_min": 24.2, "temp_max": 31.0, "humidity": 80 },
      "weather": [{ "main": "Clouds", "description": "few clouds" }],
      "wind": { "speed": 3.6 },
      "pop": 0.2,
      "rain": { "3h": 0.1 },
      "dt_txt": "2026-10-18 12:00:00"
    }
  ],
  "city": { "timezone": 3600 }
}
```

### 4. Optional live crop prices — MARKET_API_URL

- **URL pattern**: `{MARKET_API_URL}` and `{MARKET_API_URL}?crop=MAIZE&days=30`
- **Key name**: none (set only when you host your own feed)
- **Contract**: JSON array of `{crop, date, priceKobo, unit, source}` objects
- **Fallback**: on failure or invalid payload the simulated feed is used; the item's own
  `source` field decides the badge, so the badge always shows the real source
- **Sample response**:

```json
[
  { "crop": "MAIZE", "date": "2026-10-18", "priceKobo": 61000, "unit": "KG", "source": "LIVE" }
]
```

## Routes served by CropTrade

### GET /api/market/prices

Latest price of every crop from the market provider (simulated by default).
No parameters. `200 OK`:

```json
[
  { "crop": "MAIZE", "date": "2026-10-18", "priceKobo": 60000, "unit": "KG", "source": "SIMULATED" },
  { "crop": "CASSAVA", "date": "2026-10-18", "priceKobo": 34300, "unit": "KG", "source": "SIMULATED" }
]
```

### GET /api/market/history?crop=MAIZE&days=30

Daily price history for one crop, oldest first. `days` is a whole number from 1 to 90
(default 30). `200 OK`:

```json
[
  { "crop": "MAIZE", "date": "2026-10-12", "priceKobo": 61600, "unit": "KG", "source": "SIMULATED" },
  { "crop": "MAIZE", "date": "2026-10-13", "priceKobo": 61100, "unit": "KG", "source": "SIMULATED" }
]
```

Bad input → `400 Bad Request` with one sentence:

| Request | Response |
|---|---|
| `?days=30` (no crop) | `{"error":"Add a crop, for example ?crop=MAIZE."}` |
| `?crop=COCONUT` | `{"error":"Unknown crop \"COCONUT\". Check /api/market/prices for the crop list."}` |
| `?crop=MAIZE&days=99` | `{"error":"Days must be a whole number from 1 to 90."}` |

## Data labelling

Every card that shows prices, weather or exchange rates carries a data-source badge:
**Live** (fetched now), **Saved data · 3 h old** (cached/fallback), **Simulated**
(app-generated sample) or **Manual** (typed in by the farmer).
Sample numbers are PLACEHOLDERS — an expert must review them before real use.
