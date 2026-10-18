// Prints each crop's last 14 days of generated prices and today's direction.
// Used to pick per-crop salts so the demo always shows both a rising and a falling crop
// (00-global §3: "write a test that prints 14-day trends, then adjust").

import { formatInTimeZone } from "date-fns-tz";
import { CATALOG } from "../lib/market/catalog";
import { priceNaira } from "../lib/market/generator";
import { APP_TZ } from "../lib/config";

const today = formatInTimeZone(new Date(), APP_TZ, "yyyy-MM-dd");

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

let rising = 0;
let falling = 0;

console.log(`Today in ${APP_TZ}: ${today}\n`);

for (const entry of CATALOG) {
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(today, -i));
  const prices = days.map((d) => priceNaira(entry.crop, entry.salt, entry.base, d));

  const todayPrice = prices[prices.length - 1];
  const yesterdayPrice = prices[prices.length - 2];
  const weekAgoPrice = prices[0];
  const dayChange = ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100;
  const trend14 = ((todayPrice - weekAgoPrice) / weekAgoPrice) * 100;
  const arrow = dayChange >= 0 ? "▲ rising" : "▼ falling";
  if (dayChange >= 0) rising++;
  else falling++;

  console.log(
    `${entry.crop.padEnd(11)} ${prices.join(" ")}  today ₦${todayPrice}  ` +
      `1d ${dayChange.toFixed(1)}%  14d ${trend14.toFixed(1)}%  ${arrow}`
  );
}

console.log(`\nToday: ${rising} rising, ${falling} falling.`);
if (rising === 0 || falling === 0) {
  console.log("FAIL — the demo needs at least one rising AND one falling crop today. Adjust salts.");
  process.exit(1);
}
console.log("OK — demo shows every state.");
