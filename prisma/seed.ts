// CropTrade seed (steps 1 and 5: schema + demo states).
// Creates: demo farmer + farm + settings, price ticks (deterministic simulated feed),
// FX history with one stale currency, a demo Manual rate, demo stock, 2 saved
// valuations. Safe to re-run: every block deletes what it owns first.
// Run: npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { CATALOG } from "../lib/market/catalog";
import { priceKobo } from "../lib/market/generator";
import { APP_TZ, DEFAULT_FARM_LAT, DEFAULT_FARM_LON, FX_QUOTES, FX_HISTORY_DAYS } from "../lib/config";
import { mulberry32, hash32 } from "../lib/market/generator";

// The link to Neon is slow from this machine: give the pool more than the default 10 s
// (appended in memory only — .env is untouched, same as lib/db.ts).
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || raw.includes("pool_timeout=")) return raw;
  return `${raw}${raw.includes("?") ? "&" : "?"}pool_timeout=60`;
}

const prisma = new PrismaClient({ datasourceUrl: datasourceUrl() });

// Demo credentials are documented in README.md only (00-global §3).
const DEMO_EMAIL = "farmer@demo.local";
const DEMO_NAME = "Demo Farmer";
const DEMO_PASSWORD = "croptrade123";

const catalogSchema = z.array(
  z.object({
    crop: z.string().min(1),
    label: z.string().min(1),
    base: z.number().positive(),
    unit: z.enum(["KG", "TRAY", "LITRE"]),
    salt: z.string().min(1),
  })
);

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseIso(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

async function main() {
  const entries = catalogSchema.parse(CATALOG);
  const today = formatInTimeZone(new Date(), APP_TZ, "yyyy-MM-dd");

  // ---------- demo user + farm + settings ----------
  const passHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: DEMO_NAME, passHash },
    create: { email: DEMO_EMAIL, name: DEMO_NAME, passHash },
  });

  let farm = await prisma.farm.findFirst({ where: { userId: user.id, name: "Demo Farm" } });
  if (!farm) {
    farm = await prisma.farm.create({
      data: {
        userId: user.id,
        name: "Demo Farm",
        lat: DEFAULT_FARM_LAT,
        lon: DEFAULT_FARM_LON,
        currency: "NGN",
      },
    });
  }

  await prisma.settings.upsert({
    where: { farmId: farm.id },
    update: {},
    create: { farmId: farm.id, localCurrency: "NGN", exportCostPct: 0 },
  });

  // ---------- price history: 2026-01-01 .. today (deterministic simulated feed) ----------
  await prisma.priceTick.deleteMany();
  const priceRows: {
    crop: string;
    date: Date;
    priceKobo: number;
    unit: "KG" | "TRAY" | "LITRE";
    source: "SIMULATED";
  }[] = [];
  let priceCount = 0;
  for (const entry of entries) {
    let k = 0;
    let dayIso = "2026-01-01";
    while (dayIso <= today) {
      priceRows.push({
        crop: entry.crop,
        date: parseIso(dayIso),
        priceKobo: priceKobo(entry.crop, entry.salt, entry.base, dayIso),
        unit: entry.unit,
        source: "SIMULATED",
      });
      priceCount++;
      k++;
      dayIso = addDaysIso("2026-01-01", k);
    }
  }
  for (let i = 0; i < priceRows.length; i += 500) {
    await prisma.priceTick.createMany({ data: priceRows.slice(i, i + 500) });
  }

  // ---------- FX history: SIMULATED rates (1 foreign = X local) ----------
  // Demo states (step 5): EUR's saved history ends 10 days ago, so the EUR card can
  // show "Saved data" + the orange "Old rate" tag and its chart shows real gaps.
  const DEMO_STALE_DAYS = 10; // > FX_OLD_RATE_DAYS (7), PLACEHOLDER for the demo
  await prisma.fxTick.deleteMany();
  const fxStartRates: Record<string, number> = { USD: 1500, EUR: 1620, GBP: 1920 }; // PLACEHOLDERS
  const fxRows: {
    base: string;
    quote: string;
    date: Date;
    localPerForeign: number;
    source: "SIMULATED";
  }[] = [];
  for (const quote of FX_QUOTES) {
    const baseRate = fxStartRates[quote];
    const staleDays = quote === "EUR" ? DEMO_STALE_DAYS : 0;
    const dayCount = FX_HISTORY_DAYS - staleDays;
    for (let i = dayCount - 1; i >= 0; i--) {
      const dayIso = addDaysIso(today, -staleDays - i);
      const rand = mulberry32(hash32(`FX${quote}${dayIso}`))();
      const wander = (rand - 0.5) * 2 * 0.01; // ±1% per day
      const rate = Math.round(baseRate * (1 + wander) * 100) / 100;
      fxRows.push({ base: "NGN", quote, date: parseIso(dayIso), localPerForeign: rate, source: "SIMULATED" });
    }
  }
  await prisma.fxTick.createMany({ data: fxRows });

  // ---------- demo Manual rate (private to the demo farm) ----------
  // Set 10 days ago so the demo shows the "Manual" badge together with the orange
  // "Old rate" tag. "Use live rate again" deletes it; other farms never see it.
  await prisma.manualRate.deleteMany({ where: { farmId: farm.id } });
  await prisma.manualRate.create({
    data: {
      farmId: farm.id,
      quote: "GBP",
      localPerForeign: 1850, // PLACEHOLDER
      setOn: parseIso(addDaysIso(today, -DEMO_STALE_DAYS)),
    },
  });

  // ---------- demo stock (InventoryItem) ----------
  await prisma.inventoryItem.deleteMany({ where: { farmId: farm.id } });
  const stock = [
    { crop: "MAIZE", qtyKg: 250, note: "Dry, from the March harvest" },
    { crop: "CASSAVA", qtyKg: 400, note: "Awaiting processing" },
    { crop: "YAM", qtyKg: 120, note: "Store B" },
    { crop: "TOMATO", qtyKg: 80, note: "Sell within 7 days" },
    { crop: "RICE_PADDY", qtyKg: 150, note: "Unmilled" },
  ];
  await prisma.inventoryItem.createMany({
    data: stock.map((s) => ({ farmId: farm.id, crop: s.crop, qtyKg: s.qtyKg, note: s.note })),
  });

  // ---------- two saved valuations (so the list screen is not empty) ----------
  await prisma.valuation.deleteMany({ where: { farmId: farm.id } });
  const usd = await prisma.fxTick.findFirst({
    where: { quote: "USD", date: parseIso(today) },
    orderBy: { date: "desc" },
  });
  if (usd) {
    const samples = [
      { crop: "MAIZE", qtyKg: 250 },
      { crop: "TOMATO", qtyKg: 80 },
    ];
    for (const s of samples) {
      const entry = entries.find((e) => e.crop === s.crop)!;
      const localPricePerKgKobo = priceKobo(entry.crop, entry.salt, entry.base, today);
      const totalLocalKobo = s.qtyKg * localPricePerKgKobo;
      const grossForeign = Math.round((totalLocalKobo / 100 / usd.localPerForeign) * 100) / 100;
      const netForeign = Math.round(grossForeign * 100) / 100; // exportCostPct = 0
      await prisma.valuation.create({
        data: {
          farmId: farm.id,
          crop: s.crop,
          qtyKg: s.qtyKg,
          localPricePerKgKobo,
          quote: "USD",
          rate: usd.localPerForeign,
          grossForeign,
          netForeign,
          date: parseIso(today),
        },
      });
    }
  }

  const [users, farms, prices, fx, items, vals, manual] = await Promise.all([
    prisma.user.count(),
    prisma.farm.count(),
    prisma.priceTick.count(),
    prisma.fxTick.count(),
    prisma.inventoryItem.count(),
    prisma.valuation.count(),
    prisma.manualRate.count({ where: { farmId: farm.id } }),
  ]);
  console.log(`Seed complete for ${today} (${APP_TZ}).`);
  console.log(
    `  users=${users} farms=${farms} priceTicks=${prices} fxTicks=${fx} inventory=${items} valuations=${vals} manualRates=${manual}`
  );
  console.log(
    `  Demo states: EUR saved rate is ${DEMO_STALE_DAYS} days old (Saved data + Old rate, chart gaps); GBP has a Manual rate ${DEMO_STALE_DAYS} days old (Manual + Old rate).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
