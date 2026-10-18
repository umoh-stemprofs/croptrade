// Stock tests: a farmer cannot read or touch another farmer's stock,
// add/edit validation sentences, and the EMV math (integer kobo).

import { describe, expect, it } from "vitest";
import {
  addStock,
  deleteStock,
  emvKobo,
  listStock,
  totalStockValueKobo,
  updateStock,
  type StockDb,
  type StockItemRow,
} from "./inventory";

interface FakeDb {
  db: StockDb;
  items: StockItemRow[];
}

function fakeDb(): FakeDb {
  const farms = [
    { id: "farm-a", userId: "user-a", name: "Farm A", lat: 4.8, lon: 7.0 },
    { id: "farm-b", userId: "user-b", name: "Farm B", lat: 6.2, lon: 5.5 },
  ];
  const items: StockItemRow[] = [
    { id: "item-a", farmId: "farm-a", crop: "MAIZE", qtyKg: 100, note: null },
    { id: "item-b", farmId: "farm-b", crop: "YAM", qtyKg: 50, note: "Farmer B's yam" },
  ];

  const db: StockDb = {
    async firstFarmForUser(userId) {
      const farm = farms.find((f) => f.userId === userId);
      return farm ? { id: farm.id, name: farm.name, lat: farm.lat, lon: farm.lon } : null;
    },
    async findFarmOwnedByUser(userId, farmId) {
      const farm = farms.find((f) => f.userId === userId && f.id === farmId);
      return farm ? { id: farm.id } : null;
    },
    async itemsForFarm(farmId) {
      return items.filter((i) => i.farmId === farmId);
    },
    async itemById(id) {
      return items.find((i) => i.id === id) ?? null;
    },
    async createItem(row) {
      items.push({ id: `item-${items.length + 1}`, ...row });
    },
    async updateItem(id, data) {
      const item = items.find((i) => i.id === id);
      if (!item) throw new Error("not found");
      Object.assign(item, data);
    },
    async deleteItem(id) {
      const idx = items.findIndex((i) => i.id === id);
      if (idx < 0) throw new Error("not found");
      items.splice(idx, 1);
    },
  };

  return { db, items };
}

describe("ownership: a farmer never sees another farmer's stock", () => {
  it("listStock returns only this farmer's items", async () => {
    const { db, items } = fakeDb();
    const { farm, items: mine } = await listStock(db, "user-a");
    expect(farm?.id).toBe("farm-a");
    expect(mine.map((i) => i.id)).toEqual(["item-a"]);
    expect(mine.some((i) => i.id === "item-b")).toBe(false);
    expect(items).toHaveLength(2); // the database itself still has both
  });

  it("another farmer's item id cannot be edited — refused, and nothing changes", async () => {
    const { db, items } = fakeDb();
    const result = await updateStock(db, "user-a", "item-b", { qtyKg: 999 });
    expect(result).toEqual({ ok: false, error: "That stock item was not found." });
    expect(items.find((i) => i.id === "item-b")?.qtyKg).toBe(50);
  });

  it("another farmer's item id cannot be deleted — refused, and nothing changes", async () => {
    const { db, items } = fakeDb();
    const result = await deleteStock(db, "user-a", "item-b");
    expect(result).toEqual({ ok: false, error: "That stock item was not found." });
    expect(items.some((i) => i.id === "item-b")).toBe(true);
  });

  it("new stock is always added to the acting farmer's own farm", async () => {
    const { db, items } = fakeDb();
    const result = await addStock(db, "user-a", { crop: "CASSAVA", qtyKg: 20 });
    expect(result.ok).toBe(true);
    const added = items.find((i) => i.crop === "CASSAVA");
    expect(added?.farmId).toBe("farm-a");
  });

  it("editing your own item works", async () => {
    const { db, items } = fakeDb();
    const result = await updateStock(db, "user-a", "item-a", { qtyKg: 120, note: "restacked" });
    expect(result.ok).toBe(true);
    expect(items.find((i) => i.id === "item-a")).toMatchObject({ qtyKg: 120, note: "restacked" });
  });
});

describe("stock validation is one plain sentence", () => {
  it("qty 0 rejected", async () => {
    const { db } = fakeDb();
    const result = await addStock(db, "user-a", { crop: "MAIZE", qtyKg: 0 });
    expect(result).toEqual({ ok: false, error: "Quantity must be more than 0 kg." });
  });

  it("qty not a number rejected (empty form field)", async () => {
    const { db } = fakeDb();
    const result = await addStock(db, "user-a", { crop: "MAIZE", qtyKg: Number.NaN });
    expect(result).toEqual({ ok: false, error: "Enter the quantity in kg as a number." });
  });

  it("negative qty rejected", async () => {
    const { db } = fakeDb();
    const result = await addStock(db, "user-a", { crop: "MAIZE", qtyKg: -5 });
    expect(result).toEqual({ ok: false, error: "Quantity must be more than 0 kg." });
  });

  it("unknown crop rejected", async () => {
    const { db } = fakeDb();
    const result = await addStock(db, "user-a", { crop: "COCAINE", qtyKg: 5 });
    expect(result).toEqual({ ok: false, error: "Choose a crop from the list." });
  });

  it("over-long note rejected", async () => {
    const { db } = fakeDb();
    const result = await addStock(db, "user-a", {
      crop: "MAIZE",
      qtyKg: 1,
      note: "x".repeat(201),
    });
    expect(result).toEqual({ ok: false, error: "Note must be 200 characters or fewer." });
  });

  it("editing to qty 0 rejected", async () => {
    const { db } = fakeDb();
    const result = await updateStock(db, "user-a", "item-a", { qtyKg: 0 });
    expect(result).toEqual({ ok: false, error: "Quantity must be more than 0 kg." });
  });
});

describe("stock value math (EMV, integer kobo)", () => {
  it("EMV = qtyKg × price per kg in kobo", () => {
    expect(emvKobo(250, 60_000)).toBe(15_000_000); // 250 kg × ₦600 = ₦150,000
    expect(emvKobo(1, 35_000)).toBe(35_000);
  });

  it("rounds to whole kobo", () => {
    expect(emvKobo(7.5, 33_333)).toBe(249_998); // 249,997.5 → 249,998
  });

  it("total sums every row", () => {
    const total = totalStockValueKobo([
      { qtyKg: 250, priceKobo: 60_000 },
      { qtyKg: 400, priceKobo: 35_000 },
    ]);
    expect(total).toBe(15_000_000 + 14_000_000);
  });

  it("rows without a price count as zero, never NaN", () => {
    expect(totalStockValueKobo([{ qtyKg: 10, priceKobo: 0 }])).toBe(0);
  });
});
