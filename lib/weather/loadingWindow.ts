// Loading window (04-croptrade.md, pure):
// first of the next 5 forecast days with rain < 5 mm → "Best day to load: Wed 22 Oct."
// none → "Rain all week. Plan covered loading."

import { formatInTimeZone } from "date-fns-tz";
import { APP_TZ } from "../config";
import type { WeatherDay } from "./types";

export const LOADING_WINDOW_MAX_RAIN_MM = 5;

export interface LoadingWindow {
  ok: boolean;
  /** YYYY-MM-DD of the dry day, or null when none. */
  date: string | null;
  message: string;
}

export function loadingWindow(daily: WeatherDay[]): LoadingWindow {
  const nextFive = daily.slice(0, 5);
  const dryDay = nextFive.find((d) => d.rainMm < LOADING_WINDOW_MAX_RAIN_MM);
  if (dryDay) {
    const label = formatInTimeZone(
      new Date(dryDay.date + "T12:00:00Z"),
      APP_TZ,
      "EEE d MMM"
    );
    return { ok: true, date: dryDay.date, message: `Best day to load: ${label}.` };
  }
  return {
    ok: false,
    date: null,
    message: "Rain all week. Plan covered loading.",
  };
}
