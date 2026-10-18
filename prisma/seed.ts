// CropTrade seed (step 1: schema + seed).
// Creates: demo farmer + farm + settings, 90 days of inventory-ready price ticks
// (deterministic simulated feed), 30 days of SIMULATED FX history, demo stock, 2 saved valuations.
// Run: npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { CATALOG } from "../lib/market/catalog";
import { priceKobo } from "../lib/market/generator";
import { APP_TZ, DEFAULT_FARM_LAT, DEFAULT_FARM_LON, FX_QUOTES, FX_HISTORY_DAYS } from "../lib/config";
import { mulberry32, hash32 } from "../lib/market/generator";

const prisma = new PrismaClient();

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

  // ---------- FX history: 30 days of SIMULATED rates (1 foreign = X local) ----------
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
    for (let i = FX_HISTORY_DAYS - 1; i >= 0; i--) {
      const dayIso = addDaysIso(today, -i);
      const rand = mulberry32(hash32(`FX${quote}${dayIso}`))();
      const wander = (rand - 0.5) * 2 * 0.01; // ±1% per day
      const rate = Math.round(baseRate * (1 + wander) * 100) / 100;
      fxRows.push({ base: "NGN", quote, date: parseIso(dayIso), localPerForeign: rate, source: "SIMULATED" });
    }
  }
  await prisma.fxTick.createMany({ data: fxRows });

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

  const [users, farms, prices, fx, items, vals] = await Promise.all([
    prisma.user.count(),
    prisma.farm.count(),
    prisma.priceTick.count(),
    prisma.fxTick.count(),
    prisma.inventoryItem.count(),
    prisma.valuation.count(),
  ]);
  console.log(`Seed complete for ${today} (${APP_TZ}).`);
  console.log(
    `  users=${users} farms=${farms} priceTicks=${prices} fxTicks=${fx} inventory=${items} valuations=${vals}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
