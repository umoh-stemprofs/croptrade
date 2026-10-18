"use server";

// Saved valuation actions (04-croptrade.md). Every action re-checks the session and
// the farm comes from the acting user; the math is recomputed on the server so a
// tampered form can never store wrong numbers.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMarketProvider } from "../market/provider";
import { effectiveRates } from "../fx/effective";
import { buildValuation, deleteValuation, saveValuation } from "../valuations";
import { prismaValuationDb } from "../server/valuationDb";
import { prismaStockDb } from "../server/stockDb";
import { getSessionUser } from "../server/session";
import { todayIso } from "../time";
import { firstWizardMessage, wizardResultSchema } from "../value";

function rawNumber(formData: FormData, key: string): number {
  const raw = String(formData.get(key) ?? "").trim();
  return raw === "" ? Number.NaN : Number(raw);
}

export async function saveValuationAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const parsed = wizardResultSchema.safeParse({
    crop: String(formData.get("crop") ?? ""),
    qtyKg: rawNumber(formData, "qtyKg"),
    quote: String(formData.get("quote") ?? ""),
    exportCostPct: rawNumber(formData, "exportCostPct"),
  });
  if (!parsed.success) {
    redirect(`/valuations?error=${encodeURIComponent(firstWizardMessage(parsed.error))}`);
  }
  const { crop, qtyKg, quote, exportCostPct } = parsed.data;

  const farm = await prismaStockDb.firstFarmForUser(session.id);
  if (!farm) redirect("/valuations?error=No%20farm%20found%20for%20this%20account.");

  const prices = await getMarketProvider()
    .latestPrices()
    .catch(() => []);
  const price = prices.find((p) => p.crop === crop && p.unit === "KG");
  if (!price) {
    redirect("/valuations?error=No%20price%20available%20for%20that%20crop%20right%20now.%20Try%20again%20later.");
  }

  const rates = await effectiveRates(farm.id);
  const rate = rates.ok ? rates.rates.find((r) => r.quote === quote) : undefined;
  if (!rate) redirect(`/rates?missing=${quote}`);

  const built = buildValuation({
    crop,
    qtyKg,
    quote,
    exportCostPct,
    priceKobo: price.priceKobo,
    localPerForeign: rate.localPerForeign,
    rateDate: rate.date,
    today: todayIso(),
  });
  if (!built.ok) {
    redirect(`/valuations?error=${encodeURIComponent(built.error)}`);
  }

  const saved = await saveValuation(prismaValuationDb, session.id, built.row);
  if (!saved.ok) {
    redirect(`/valuations?error=${encodeURIComponent(saved.error)}`);
  }
  revalidatePath("/valuations");
  revalidatePath("/");
  redirect("/valuations?saved=1");
}

export async function deleteValuationAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const result = await deleteValuation(
    prismaValuationDb,
    session.id,
    String(formData.get("id") ?? "")
  );
  if (!result.ok) redirect(`/valuations?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/valuations");
  redirect("/valuations?deleted=1");
}
