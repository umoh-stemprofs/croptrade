// Prisma-backed WeatherSnapshot store (server only).

import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import type { WeatherData } from "./types";
import type { WeatherSnapshotRecord, WeatherSnapshotStore } from "./getWeather";

export const prismaSnapshotStore: WeatherSnapshotStore = {
  async latest(farmId: string): Promise<WeatherSnapshotRecord | null> {
    const row = await prisma.weatherSnapshot.findFirst({
      where: { farmId },
      orderBy: { fetchedAt: "desc" },
    });
    if (!row) return null;
    return { fetchedAt: row.fetchedAt, source: row.source, payload: row.payload };
  },

  async save(farmId: string, source: string, payload: WeatherData): Promise<void> {
    await prisma.weatherSnapshot.create({
      data: { farmId, source, payload: payload as unknown as Prisma.InputJsonValue },
    });
  },
};
