"use server";

// Stock server actions. Every action re-checks the session, and lib/inventory.ts
// re-checks that the item belongs to a farm owned by this user (00-global §3).

import { redirect } from "next/navigation";
import { addStock, deleteStock, updateStock } from "../inventory";
import { prismaStockDb } from "../server/stockDb";
import { getSessionUser } from "../server/session";

export async function addStockAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const rawQty = String(formData.get("qtyKg") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const result = await addStock(prismaStockDb, session.id, {
    crop: String(formData.get("crop") ?? ""),
    qtyKg: rawQty === "" ? Number.NaN : Number(rawQty),
    note: note === "" ? undefined : note,
  });
  if (!result.ok) redirect(`/stock?error=${encodeURIComponent(result.error)}`);
  redirect("/stock");
}

export async function updateStockAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const rawQty = String(formData.get("qtyKg") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const result = await updateStock(prismaStockDb, session.id, String(formData.get("id") ?? ""), {
    qtyKg: rawQty === "" ? Number.NaN : Number(rawQty),
    note: note === "" ? null : note,
  });
  if (!result.ok) redirect(`/stock?error=${encodeURIComponent(result.error)}`);
  redirect("/stock");
}

export async function deleteStockAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const result = await deleteStock(prismaStockDb, session.id, String(formData.get("id") ?? ""));
  if (!result.ok) redirect(`/stock?error=${encodeURIComponent(result.error)}`);
  redirect("/stock");
}
