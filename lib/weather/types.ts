// Weather adapter types (00-global §3):
// interface WeatherProvider returning {current:{tempC, humidity, windKmh, text}, daily:[5 × ...], fetchedAt, source}

import { z } from "zod";

export interface WeatherDay {
  date: string; // YYYY-MM-DD
  minC: number;
  maxC: number;
  rainMm: number;
  rainChancePct: number;
}

export interface WeatherData {
  current: {
    tempC: number;
    humidity: number; // %
    windKmh: number;
    text: string; // plain-words condition, e.g. "Partly cloudy"
  };
  daily: WeatherDay[]; // up to 5 days
  fetchedAt: string; // ISO timestamp
  source: string; // OPEN_METEO | OWM
}

/** Validates our own payload shape (also used for cached WeatherSnapshot payloads). */
export const weatherDataSchema = z.object({
  current: z.object({
    tempC: z.number(),
    humidity: z.number(),
    windKmh: z.number(),
    text: z.string().min(1),
  }),
  daily: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        minC: z.number(),
        maxC: z.number(),
        rainMm: z.number(),
        rainChancePct: z.number(),
      })
    )
    .min(1),
  fetchedAt: z.string(),
  source: z.string().min(1),
});

export type WeatherProvider = (lat: number, lon: number) => Promise<WeatherData>;
