// Prisma-backed StockDb (server only). Used by the stock server actions.

import { prisma } from "../db";
import type { StockDb, StockItemRow } from "../inventory";

export const prismaStockDb: StockDb = {
  async firstFarmForUser(userId) {
    const farm = await prisma.farm.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return farm ? { id: farm.id, name: farm.name, lat: farm.lat, lon: farm.lon } : null;
  },

  async findFarmOwnedByUser(userId, farmId) {
    const farm = await prisma.farm.findFirst({ where: { id: farmId, userId } });
    return farm ? { id: farm.id } : null;
  },

  async itemsForFarm(farmId): Promise<StockItemRow[]> {
    const rows = await prisma.inventoryItem.findMany({
      where: { farmId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      farmId: r.farmId,
      crop: r.crop,
      qtyKg: r.qtyKg,
      note: r.note,
    }));
  },

  async itemById(id) {
    const r = await prisma.inventoryItem.findUnique({ where: { id } });
    return r
      ? { id: r.id, farmId: r.farmId, crop: r.crop, qtyKg: r.qtyKg, note: r.note }
      : null;
  },

  async createItem(row) {
    await prisma.inventoryItem.create({ data: row });
  },

  async updateItem(id, data) {
    await prisma.inventoryItem.update({ where: { id }, data });
  },

  async deleteItem(id) {
    await prisma.inventoryItem.delete({ where: { id } });
  },
};
