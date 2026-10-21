// OpenWeatherMap 5 day / 3 hour forecast provider — used only when OWM_API_KEY is set.
// Shape verified against https://openweathermap.org/forecast5 (2026-10):
// list[] { dt (unix, UTC), main { temp, temp_min, temp_max, humidity °C/% },
//          weather[0] { main, description }, wind.speed m/s, pop 0..1,
//          rain? { "3h" mm }, snow? { "3h" mm }, dt_txt }
// city { timezone: seconds offset from UTC }

import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TZ } from "../config";
import { fetchJson, type FetchLike } from "../server/http";
import {
  weatherDataSchema,
  type DayBarometricRecord,
  type WeatherData,
} from "./types";

export const OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";

const owmItemSchema = z.object({
  dt: z.number(),
  main: z.object({
    temp: z.number(),
    temp_min: z.number(),
    temp_max: z.number(),
    humidity: z.number(),
    pressure: z.number().optional(),
  }),
  weather: z
    .array(z.object({ main: z.string(), description: z.string() }))
    .min(1),
  wind: z.object({ speed: z.number() }),
  pop: z.number().optional(),
  rain: z.object({ "3h": z.number() }).optional(),
  snow: z.object({ "3h": z.number() }).optional(),
  dt_txt: z.string(),
});

const owmSchema = z.object({
  list: z.array(owmItemSchema).min(1),
  city: z.object({ timezone: z.number() }),
});

export function owmUrl(lat: number, lon: number, apiKey: string): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: apiKey,
    units: "metric",
  });
  return `${OWM_FORECAST_URL}?${params.toString()}`;
}

const OWM_TEXT: Record<string, string> = {
  Clear: "Clear sky",
  Clouds: "Cloudy",
  Rain: "Rain",
  Drizzle: "Drizzle",
  Snow: "Snow",
  Thunderstorm: "Thunderstorm",
  Mist: "Mist",
  Fog: "Fog",
  Haze: "Haze",
  Dust: "Dust",
  Smoke: "Smoke",
};

function owmText(main: string): string {
  return OWM_TEXT[main] ?? "Unknown conditions";
}

/** Fold the 3-hour list into 5 daily entries, grouped by day in APP_TZ. */
export async function fetchOpenWeatherMap(
  lat: number,
  lon: number,
  apiKey: string,
  fetchImpl: FetchLike = fetch
): Promise<WeatherData> {
  const json = owmSchema.parse(
    await fetchJson<unknown>(owmUrl(lat, lon, apiKey), { fetchImpl })
  );

  const first = json.list[0];
  const groups = new Map<
    string,
    { minC: number; maxC: number; rainMm: number; rainChancePct: number }
  >();
  for (const item of json.list) {
    const date = formatInTimeZone(new Date(item.dt * 1000), APP_TZ, "yyyy-MM-dd");
    const rainMm = (item.rain?.["3h"] ?? 0) + (item.snow?.["3h"] ?? 0);
    const chance = Math.round((item.pop ?? 0) * 100);
    const g = groups.get(date) ?? {
      minC: item.main.temp_min,
      maxC: item.main.temp_max,
      rainMm: 0,
      rainChancePct: 0,
    };
    g.minC = Math.min(g.minC, item.main.temp_min);
    g.maxC = Math.max(g.maxC, item.main.temp_max);
    g.rainMm = Math.round((g.rainMm + rainMm) * 10) / 10;
    g.rainChancePct = Math.max(g.rainChancePct, chance);
    groups.set(date, g);
  }

  const daily = [...groups.entries()]
    .slice(0, 5)
    .map(([date, g]) => ({ date, ...g }));

  // OWM is 3-hourly, so a 3-hour fall is the gap between consecutive readings.
  const byDate = new Map<string, number[]>();
  for (const item of json.list) {
    const date = formatInTimeZone(new Date(item.dt * 1000), APP_TZ, "yyyy-MM-dd");
    if (typeof item.main.pressure !== "number") continue;
    const list = byDate.get(date) ?? [];
    list.push(item.main.pressure);
    byDate.set(date, list);
  }
  const barometric: DayBarometricRecord[] = daily.map(({ date }) => {
    const points = byDate.get(date) ?? [];
    if (points.length < 2) return { date, drop3hMax: null, meanHpa: null };
    let drop3hMax = -Infinity;
    for (let i = 0; i + 1 < points.length; i += 1) {
      drop3hMax = Math.max(drop3hMax, points[i] - points[i + 1]);
    }
    const mean = points.reduce((sum, value) => sum + value, 0) / points.length;
    return {
      date,
      drop3hMax: Math.round(drop3hMax * 10) / 10,
      meanHpa: Math.round(mean * 10) / 10,
    };
  });

  const data: WeatherData = {
    current: {
      tempC: first.main.temp,
      humidity: first.main.humidity,
      windKmh: Math.round(first.wind.speed * 3.6 * 10) / 10, // metric m/s → km/h
      text: owmText(first.weather[0].main),
      pressureHpa: typeof first.main.pressure === "number" ? first.main.pressure : null,
    },
    daily,
    barometric,
    fetchedAt: new Date().toISOString(),
    source: "OWM",
  };
  return weatherDataSchema.parse(data);
}
