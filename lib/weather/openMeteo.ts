// Open-Meteo forecast provider (default, no API key).
// Shape verified against https://open-meteo.com/en/docs (2026-10):
// current { time, temperature_2m °C, relative_humidity_2m %, weather_code, wind_speed_10m km/h,
//           pressure_msl hPa }
// hourly  { time[], pressure_msl[] } — used to derive each day's steepest 3 h fall
// daily   { time[], weather_code[], temperature_2m_min[], temperature_2m_max[],
//           precipitation_sum mm, precipitation_probability_max % }

import { z } from "zod";
import { APP_TZ } from "../config";
import { fetchJson, type FetchLike } from "../server/http";
import {
  weatherDataSchema,
  type DayBarometricRecord,
  type WeatherData,
} from "./types";

export const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

const openMeteoSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    relative_humidity_2m: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
    pressure_msl: z.number().optional(),
  }),
  hourly: z
    .object({
      time: z.array(z.string()),
      pressure_msl: z.array(z.number().nullable()),
    })
    .optional(),
  daily: z.object({
    time: z.array(z.string()).min(1),
    weather_code: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    precipitation_sum: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()),
  }),
});

/** WMO weather codes → plain words (verified against the Open-Meteo docs). */
export function wmoText(code: number): string {
  const map: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Dense drizzle",
    56: "Freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Rain showers",
    82: "Violent rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm with hail",
  };
  return map[code] ?? "Unknown conditions";
}

export function openMeteoUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,pressure_msl",
    hourly: "pressure_msl",
    forecast_days: "5",
    timezone: APP_TZ,
  });
  return `${OPEN_METEO_URL}?${params.toString()}`;
}

/**
 * Derive each forecast day's barometric summary from the hourly pressure series.
 * Returns an empty array when the provider supplied no usable hourly pressure, so
 * callers can render "pressure trend unavailable" rather than inventing a number.
 */
export function deriveBarometric(
  hourlyTimes: readonly string[],
  hourlyPressure: readonly (number | null)[],
  dailyDates: readonly string[]
): DayBarometricRecord[] {
  const rows: DayBarometricRecord[] = [];
  for (const date of dailyDates) {
    // Hourly timestamps look like "2026-10-23T09:00" — group by their date prefix.
    const points: number[] = [];
    for (let i = 0; i < hourlyTimes.length; i += 1) {
      if (hourlyTimes[i].slice(0, 10) !== date) continue;
      const value = hourlyPressure[i];
      if (typeof value === "number" && Number.isFinite(value)) points.push(value);
    }
    if (points.length < 2) {
      rows.push({ date, drop3hMax: null, meanHpa: null });
      continue;
    }
    let drop3hMax: number | null = null;
    // A 3-hour fall is the drop from reading i to reading i+3 (hourly cadence).
    for (let i = 0; i + 3 < points.length; i += 1) {
      const fall = points[i] - points[i + 3];
      if (drop3hMax === null || fall > drop3hMax) drop3hMax = fall;
    }
    const mean = points.reduce((sum, value) => sum + value, 0) / points.length;
    rows.push({
      date,
      drop3hMax: drop3hMax === null ? null : Math.round(drop3hMax * 10) / 10,
      meanHpa: Math.round(mean * 10) / 10,
    });
  }
  return rows;
}

export async function fetchOpenMeteo(
  lat: number,
  lon: number,
  fetchImpl: FetchLike = fetch
): Promise<WeatherData> {
  const json = openMeteoSchema.parse(
    await fetchJson<unknown>(openMeteoUrl(lat, lon), { fetchImpl })
  );
  const daily = json.daily.time.map((date, i) => ({
    date,
    minC: json.daily.temperature_2m_min[i],
    maxC: json.daily.temperature_2m_max[i],
    rainMm: json.daily.precipitation_sum[i],
    rainChancePct: json.daily.precipitation_probability_max[i] ?? 0,
  }));
  const barometric = json.hourly
    ? deriveBarometric(json.hourly.time, json.hourly.pressure_msl, json.daily.time)
    : [];
  const data: WeatherData = {
    current: {
      tempC: json.current.temperature_2m,
      humidity: json.current.relative_humidity_2m,
      windKmh: json.current.wind_speed_10m,
      text: wmoText(json.current.weather_code),
      pressureHpa:
        typeof json.current.pressure_msl === "number" ? json.current.pressure_msl : null,
    },
    daily,
    barometric,
    fetchedAt: new Date().toISOString(),
    source: "OPEN_METEO",
  };
  return weatherDataSchema.parse(data);
}
