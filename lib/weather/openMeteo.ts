// Open-Meteo forecast provider (default, no API key).
// Shape verified against https://open-meteo.com/en/docs (2026-10):
// current { time, temperature_2m °C, relative_humidity_2m %, weather_code, wind_speed_10m km/h }
// daily   { time[], weather_code[], temperature_2m_min[], temperature_2m_max[],
//           precipitation_sum mm, precipitation_probability_max % }

import { z } from "zod";
import { APP_TZ } from "../config";
import { fetchJson, type FetchLike } from "../server/http";
import { weatherDataSchema, type WeatherData } from "./types";

export const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

const openMeteoSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    relative_humidity_2m: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
  }),
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
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max",
    timezone: APP_TZ,
    forecast_days: "5",
  });
  return `${OPEN_METEO_URL}?${params.toString()}`;
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
  const data: WeatherData = {
    current: {
      tempC: json.current.temperature_2m,
      humidity: json.current.relative_humidity_2m,
      windKmh: json.current.wind_speed_10m,
      text: wmoText(json.current.weather_code),
    },
    daily,
    fetchedAt: new Date().toISOString(),
    source: "OPEN_METEO",
  };
  return weatherDataSchema.parse(data);
}
