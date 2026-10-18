"use server";

// Farm settings server action. Re-checks the session and only updates the farm
// owned by the acting user (no client-supplied farm id).

import { redirect } from "next/navigation";
import { prisma } from "../db";
import { firstSettingsMessage, settingsSchema } from "../settings";
import { getSessionUser } from "../server/session";

function rawNumber(formData: FormData, key: string): number {
  const raw = String(formData.get(key) ?? "").trim();
  return raw === "" ? Number.NaN : Number(raw);
}

export async function saveSettingsAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const parsed = settingsSchema.safeParse({
    farmName: String(formData.get("farmName") ?? ""),
    lat: rawNumber(formData, "lat"),
    lon: rawNumber(formData, "lon"),
    exportCostPct: rawNumber(formData, "exportCostPct"),
  });
  if (!parsed.success) {
    redirect(`/settings?error=${encodeURIComponent(firstSettingsMessage(parsed.error))}`);
  }
  const { farmName, lat, lon, exportCostPct } = parsed.data;

  const saved = await (async () => {
    try {
      const farm = await prisma.farm.findFirst({
        where: { userId: session.id },
        orderBy: { createdAt: "asc" },
      });
      if (!farm) return "no-farm" as const;
      await prisma.farm.update({ where: { id: farm.id }, data: { name: farmName, lat, lon } });
      await prisma.settings.upsert({
        where: { farmId: farm.id },
        update: { exportCostPct },
        create: { farmId: farm.id, exportCostPct },
      });
      return "ok" as const;
    } catch {
      return "server" as const;
    }
  })();

  if (saved === "no-farm") {
    redirect(`/settings?error=${encodeURIComponent("No farm found for this account.")}`);
  }
  if (saved === "server") {
    redirect(`/settings?error=${encodeURIComponent("Something went wrong. Try again in a moment.")}`);
  }
  redirect("/settings?saved=1");
}
