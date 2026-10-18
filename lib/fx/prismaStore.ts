// Prisma-backed FxStore (server only). FxTick has a unique constraint on (quote, date).

import { prisma } from "../db";
import type { FxSavedRate, FxSourceKey, FxStore } from "./store";

const prismaFx = prisma.fxTick;

async function prismaTick(quote: string) {
  return prisma.fxTick.findFirst({ where: { quote }, orderBy: { date: "desc" } });
}

export const prismaFxStore: FxStore = {
  async latestSaved(quote: string): Promise<FxSavedRate | null> {
    const tick = await prismaTick(quote);
    if (!tick) return null;
    return {
      quote: tick.quote,
      localPerForeign: tick.localPerForeign,
      date: tick.date.toISOString().slice(0, 10),
      source: tick.source as FxSourceKey,
    };
  },

  async findByDate(quote: string, date: string) {
    const tick = await prismaFx.findFirst({
      where: { quote, date: new Date(date + "T00:00:00Z") },
    });
    if (!tick) return null;
    return { id: tick.id, source: tick.source as FxSourceKey };
  },

  async create(row) {
    await prismaFx.create({
      data: {
        base: "NGN",
        quote: row.quote,
        date: new Date(row.date + "T00:00:00Z"),
        localPerForeign: row.localPerForeign,
        source: row.source,
      },
    });
  },

  async updateToLive(id, localPerForeign) {
    await prismaFx.update({ where: { id }, data: { localPerForeign, source: "LIVE" } });
  },
};
