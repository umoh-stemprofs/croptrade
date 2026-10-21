// CropTrade seed (schema + demo states).
// Creates: demo farmer + farm + settings, a demo Manual rate and demo stock.
// Neither crop prices nor FX history are seeded — prices come only from the live
// WFP/HDX feed (lib/market/wfp.ts) and rates from open.er-api.com (lib/fx/service.ts),
// so nothing here can be mistaken for a price or a rate.
// Safe to re-run: every block deletes what it owns first.
// Run: npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TZ, DEFAULT_FARM_LAT, DEFAULT_FARM_LON } from "../lib/config";

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

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseIso(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

async function main() {
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

  // ---------- retire generated price data ----------
  // Earlier seeds wrote a deterministic "simulated" price feed and saved valuations
  // built from it. Prices are live now, so those rows must not linger.
  await prisma.priceTick.deleteMany();
  await prisma.valuation.deleteMany({ where: { farmId: farm.id } });

  // ---------- FX history: LIVE ticks only ----------
  // The 30-day chart is fed by real open.er-api.com pulls (lib/fx/service.ts saves
  // each one as LIVE). Simulated rows seeded by earlier versions are purged here so
  // they can never be mistaken for a rate; reads filter to LIVE as well
  // (lib/fx/history.ts), so even an old copy of the database cannot feed them in.
  const DEMO_STALE_DAYS = 10; // > FX_OLD_RATE_DAYS (7), so the Manual demo shows "Old rate"
  await prisma.fxTick.deleteMany({ where: { source: "SIMULATED" } });

  // ---------- demo Manual rate (private to the demo farm) ----------
  // Deliberate override, set 10 days ago so the demo shows the "Manual" badge together
  // with the orange "Old rate" tag. "Use live rate again" deletes it; other farms never
  // see it. Manual rates are stored apart from FxTick, so they never enter the chart.
  await prisma.manualRate.deleteMany({ where: { farmId: farm.id } });
  await prisma.manualRate.create({
    data: {
      farmId: farm.id,
      quote: "GBP",
      localPerForeign: 1850, // demo GBP rate, set 10 days ago
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

  const [users, farms, fx, items, manual] = await Promise.all([
    prisma.user.count(),
    prisma.farm.count(),
    prisma.fxTick.count(),
    prisma.inventoryItem.count(),
    prisma.manualRate.count({ where: { farmId: farm.id } }),
  ]);
  console.log(`Seed complete for ${today} (${APP_TZ}).`);
  console.log(
    `  users=${users} farms=${farms} fxTicks=${fx} inventory=${items} manualRates=${manual}`
  );
  console.log("  Crop prices are not seeded: they are fetched live from WFP/HDX.");
  console.log("  FX history is not seeded: rates are fetched live from open.er-api.com.");
  console.log(
    `  Demo state: GBP has a Manual rate ${DEMO_STALE_DAYS} days old (Manual + Old rate).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
