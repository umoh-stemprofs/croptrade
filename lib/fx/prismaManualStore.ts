// Prisma-backed ManualRateStore (server only). ManualRate is keyed by (farmId, quote),
// so each farm has at most one override per currency.

import { prisma } from "../db";
import { todayIso } from "../time";
import type { ManualRateRow } from "./manual";
import type { ManualRateStore } from "./manualStore";

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** @db.Date value for today in APP_TZ. */
function todayDate(): Date {
  return new Date(todayIso() + "T00:00:00Z");
}

export const prismaManualStore: ManualRateStore = {
  async forFarm(farmId: string): Promise<ManualRateRow[]> {
    const rows = await prisma.manualRate.findMany({ where: { farmId } });
    return rows.map((row) => ({
      quote: row.quote,
      localPerForeign: row.localPerForeign,
      setOn: isoDay(row.setOn),
    }));
  },

  async set(farmId, quote, localPerForeign) {
    await prisma.manualRate.upsert({
      where: { farmId_quote: { farmId, quote } },
      update: { localPerForeign, setOn: todayDate() },
      create: { farmId, quote, localPerForeign, setOn: todayDate() },
    });
  },

  async remove(farmId, quote) {
    await prisma.manualRate.deleteMany({ where: { farmId, quote } });
  },
};
