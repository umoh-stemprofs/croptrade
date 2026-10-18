// GET /api/market/history?crop=MAIZE&days=30 — daily price history, days 1..90 (00-global §3).
// Bad input returns 400 with one sentence saying what to fix.

import { type NextRequest } from "next/server";
import { getMarketProvider } from "@/lib/market/provider";
import { parseHistoryParams } from "@/lib/market/query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = parseHistoryParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const rows = await getMarketProvider().history(parsed.crop, parsed.days);
  return Response.json(rows);
}
