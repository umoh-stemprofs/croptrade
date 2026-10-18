// Stock logic (00-global §3 + 04-croptrade.md): ownership-checked inventory operations
// with an injected database, plus the Estimated Market Value math.
// EMV(item) = qtyKg × latest price per kg, in integer kobo (₦1 = 100 kobo).
// A farmer must never see or touch another farmer's stock — every operation below
// resolves the item's farm against the acting userId.

import { z } from "zod";
import { CATALOG, getCatalogEntry } from "./market/catalog";

/** Stock is measured in kg, so only per-kg crops can be added. */
export const KG_CROPS: string[] = CATALOG.filter((e) => e.unit === "KG").map((e) => e.crop);

export const addStockSchema = z.object({
  crop: z
    .string()
    .refine((v) => KG_CROPS.includes(v), "Choose a crop from the list."),
  qtyKg: z
    .number({ invalid_type_error: "Enter the quantity in kg as a number." })
    .finite("Enter the quantity in kg as a number.")
    .positive("Quantity must be more than 0 kg."),
  note: z
    .string()
    .trim()
    .max(200, "Note must be 200 characters or fewer.")
    .optional(),
});
export type AddStockInput = z.infer<typeof addStockSchema>;

export const updateStockSchema = z.object({
  qtyKg: z
    .number({ invalid_type_error: "Enter the quantity in kg as a number." })
    .finite("Enter the quantity in kg as a number.")
    .positive("Quantity must be more than 0 kg.")
    .optional(),
  note: z
    .string()
    .trim()
    .max(200, "Note must be 200 characters or fewer.")
    .nullable()
    .optional(),
});
export type UpdateStockInput = z.infer<typeof updateStockSchema>;

/** EMV of one item in integer kobo. */
export function emvKobo(qtyKg: number, pricePerKgKobo: number): number {
  return Math.round(qtyKg * pricePerKgKobo);
}

/** Total stock value in integer kobo. */
export function totalStockValueKobo(rows: { qtyKg: number; priceKobo: number }[]): number {
  return rows.reduce((sum, r) => sum + emvKobo(r.qtyKg, r.priceKobo), 0);
}

// ---------- database boundary (injected, so ownership is testable) ----------

export interface StockItemRow {
  id: string;
  farmId: string;
  crop: string;
  qtyKg: number;
  note: string | null;
}

export interface StockFarmRow {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface StockDb {
  firstFarmForUser(userId: string): Promise<StockFarmRow | null>;
  findFarmOwnedByUser(userId: string, farmId: string): Promise<{ id: string } | null>;
  itemsForFarm(farmId: string): Promise<StockItemRow[]>;
  itemById(id: string): Promise<StockItemRow | null>;
  createItem(row: { farmId: string; crop: string; qtyKg: number; note: string | null }): Promise<void>;
  updateItem(id: string, data: { qtyKg?: number; note?: string | null }): Promise<void>;
  deleteItem(id: string): Promise<void>;
}

export type StockResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "That stock item was not found.";

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

/** The user's farm + their items. Nothing from any other farm is ever returned. */
export async function listStock(
  db: StockDb,
  userId: string
): Promise<{ farm: StockFarmRow | null; items: StockItemRow[] }> {
  const farm = await db.firstFarmForUser(userId);
  if (!farm) return { farm: null, items: [] };
  return { farm, items: await db.itemsForFarm(farm.id) };
}

export async function addStock(
  db: StockDb,
  userId: string,
  input: AddStockInput
): Promise<StockResult> {
  const parsed = addStockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstMessage(parsed.error) };
  const farm = await db.firstFarmForUser(userId);
  if (!farm) return { ok: false, error: "No farm found for this account." };
  await db.createItem({
    farmId: farm.id,
    crop: parsed.data.crop,
    qtyKg: parsed.data.qtyKg,
    note: parsed.data.note ?? null,
  });
  return { ok: true };
}

export async function updateStock(
  db: StockDb,
  userId: string,
  itemId: string,
  input: UpdateStockInput
): Promise<StockResult> {
  const parsed = updateStockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstMessage(parsed.error) };
  const item = await db.itemById(itemId);
  const farm = item ? await db.findFarmOwnedByUser(userId, item.farmId) : null;
  if (!item || !farm) return { ok: false, error: NOT_FOUND };
  await db.updateItem(itemId, parsed.data);
  return { ok: true };
}

export async function deleteStock(
  db: StockDb,
  userId: string,
  itemId: string
): Promise<StockResult> {
  const item = await db.itemById(itemId);
  const farm = item ? await db.findFarmOwnedByUser(userId, item.farmId) : null;
  if (!item || !farm) return { ok: false, error: NOT_FOUND };
  await db.deleteItem(itemId);
  return { ok: true };
}

/** Crop label for display, e.g. MAIZE → "Maize". */
export function cropLabel(crop: string): string {
  return getCatalogEntry(crop)?.label ?? crop;
}
