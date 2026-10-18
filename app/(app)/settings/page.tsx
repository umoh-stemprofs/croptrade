// Farm settings (S-FARM): name, latitude, longitude, default export cost %.
// Validated on the server: lat −90..90, lon −180..180, cost 0..100.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { prisma } from "@/lib/db";
import { prismaStockDb } from "@/lib/server/stockDb";
import { saveSettingsAction } from "@/lib/actions/settings";
import { ErrorLine, SuccessLine } from "@/components/ui/Notice";
import { Field, primaryButtonClass } from "@/components/ui/Field";
import { UseMyLocation } from "@/components/UseMyLocation";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; saved?: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const farm = await prismaStockDb.firstFarmForUser(user.id);
  const settings = farm
    ? await prisma.settings.findUnique({ where: { farmId: farm.id } })
    : null;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[32px] font-bold leading-10">Settings</h1>
        <p className="mt-1 text-base leading-6 text-muted">
          Your farm details. The coordinates decide which weather you see.
        </p>
      </header>

      {searchParams.error ? <ErrorLine message={searchParams.error} /> : null}
      {searchParams.saved ? <SuccessLine message="Settings saved." /> : null}

      <section className="mt-6 max-w-[560px] rounded-card border border-border bg-surface p-6 shadow-card">
        {farm ? (
          <form action={saveSettingsAction} className="space-y-4">
            <Field
              label="Farm name"
              name="farmName"
              required
              maxLength={80}
              defaultValue={farm.name}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Latitude"
                name="lat"
                type="number"
                step="any"
                min={-90}
                max={90}
                required
                inputMode="decimal"
                defaultValue={farm.lat}
                helper="Between −90 and 90."
              />
              <Field
                label="Longitude"
                name="lon"
                type="number"
                step="any"
                min={-180}
                max={180}
                required
                inputMode="decimal"
                defaultValue={farm.lon}
                helper="Between −180 and 180."
              />
            </div>
            <UseMyLocation />
            <Field
              label="Default export cost %"
              name="exportCostPct"
              type="number"
              step="any"
              min={0}
              max={100}
              required
              inputMode="decimal"
              defaultValue={settings?.exportCostPct ?? 0}
              helper="Costs taken off the export value, from 0 to 100. Used by the value wizard in the next step."
            />
            <p className="text-sm leading-5 text-muted">
              Currency: NGN (fixed for now).
            </p>
            <button type="submit" className={`${primaryButtonClass} sm:w-auto sm:px-6`}>
              Save settings
            </button>
          </form>
        ) : (
          <p className="text-base text-muted">No farm found for this account.</p>
        )}
      </section>
    </>
  );
}
