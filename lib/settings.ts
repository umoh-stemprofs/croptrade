// Farm settings logic (04-croptrade.md): name, lat −90..90, lon −180..180,
// export cost 0..100. Pure Zod schema — the action in lib/actions/settings.ts is thin.

import { z } from "zod";

export const settingsSchema = z.object({
  farmName: z
    .string()
    .trim()
    .min(1, "Enter a farm name.")
    .max(80, "Farm name must be 80 characters or fewer."),
  lat: z
    .number({ invalid_type_error: "Latitude must be a number between -90 and 90." })
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90."),
  lon: z
    .number({ invalid_type_error: "Longitude must be a number between -180 and 180." })
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180."),
  exportCostPct: z
    .number({ invalid_type_error: "Export cost must be a number from 0 to 100." })
    .min(0, "Export cost must be between 0 and 100.")
    .max(100, "Export cost must be between 0 and 100."),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export function firstSettingsMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}
