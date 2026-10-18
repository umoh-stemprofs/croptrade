// GET /api/market/prices — latest price of every crop (00-global §3).
// Returns [{crop, date, priceKobo, unit, source}].

import { getMarketProvider } from "@/lib/market/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const prices = await getMarketProvider().latestPrices();
  return Response.json(prices);
}
