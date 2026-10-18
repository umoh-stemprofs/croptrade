// Prisma-backed ValuationDb (server only). Ownership is resolved through the farm.

import { prisma } from "../db";
import type { ValuationDb, ValuationRow } from "../valuations";

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toRow(row: {
  id: string;
  farmId: string;
  crop: string;
  qtyKg: number;
  localPricePerKgKobo: number;
  quote: string;
  rate: number;
  grossForeign: number;
  netForeign: number;
  date: Date;
}): ValuationRow {
  return { ...row, date: isoDay(row.date) };
}

export const prismaValuationDb: ValuationDb = {
  async firstFarmForUser(userId) {
    return prisma.farm.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
  },

  async listForFarm(farmId) {
    const rows = await prisma.valuation.findMany({
      where: { farmId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
    return rows.map(toRow);
  },

  async create(row) {
    await prisma.valuation.create({
      data: { ...row, date: new Date(row.date + "T00:00:00Z") },
    });
  },

  async findById(id) {
    const row = await prisma.valuation.findUnique({ where: { id } });
    return row ? toRow(row) : null;
  },

  async findFarmOwnedByUser(userId, farmId) {
    return prisma.farm.findFirst({ where: { id: farmId, userId }, select: { id: true } });
  },

  async deleteById(id) {
    await prisma.valuation.delete({ where: { id } });
  },
};
