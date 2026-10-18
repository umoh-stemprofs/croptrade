"use server";

// Manual rate actions (04-croptrade.md). A manual rate belongs to the acting user's
// own farm only — the farm id comes from the session, never from the form.
// "Use live rate again" deletes the override so the shared rate applies again.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { FX_QUOTES } from "../config";
import { manualRateSchema } from "../fx/manual";
import { prismaManualStore } from "../fx/prismaManualStore";
import { getSessionUser } from "../server/session";

function rawNumber(formData: FormData, key: string): number {
  const raw = String(formData.get(key) ?? "").trim();
  return raw === "" ? Number.NaN : Number(raw);
}

async function farmIdFor(userId: string): Promise<string | null> {
  const farm = await prisma.farm.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return farm?.id ?? null;
}

export async function setManualRateAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const quoteRaw = String(formData.get("quote") ?? "");
  const backTo = FX_QUOTES.includes(quoteRaw as (typeof FX_QUOTES)[number])
    ? `/rates/change?quote=${quoteRaw}`
    : "/rates/change";

  const parsed = manualRateSchema.safeParse({
    quote: quoteRaw,
    localPerForeign: rawNumber(formData, "localPerForeign"),
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check the rate and try again.";
    const separator = backTo.includes("?") ? "&" : "?";
    redirect(`${backTo}${separator}error=${encodeURIComponent(message)}`);
  }

  const farmId = await farmIdFor(session.id);
  if (!farmId) redirect("/rates?error=No%20farm%20found%20for%20this%20account.");

  await prismaManualStore.set(farmId, parsed.data.quote, parsed.data.localPerForeign);
  revalidatePath("/rates");
  revalidatePath("/rates/change");
  revalidatePath("/");
  revalidatePath("/value");
  revalidatePath("/value/result");
  redirect("/rates?saved=1");
}

export async function clearManualRateAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const quote = String(formData.get("quote") ?? "");
  if (!FX_QUOTES.includes(quote as (typeof FX_QUOTES)[number])) {
    redirect("/rates?error=Choose%20USD%2C%20EUR%20or%20GBP.");
  }

  const farmId = await farmIdFor(session.id);
  if (!farmId) redirect("/rates?error=No%20farm%20found%20for%20this%20account.");

  await prismaManualStore.remove(farmId, quote);
  revalidatePath("/rates");
  revalidatePath("/rates/change");
  revalidatePath("/");
  revalidatePath("/value");
  revalidatePath("/value/result");
  redirect("/rates?cleared=1");
}
