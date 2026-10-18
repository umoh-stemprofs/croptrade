// Prisma client singleton (server only).
// The connection pool timeout is raised for this project's slow link to Neon: the
// default 10 s is shorter than a cold pooled handshake here. The env file is not
// modified — this only appends a Prisma URL parameter in memory.

import { PrismaClient } from "@prisma/client";

function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || raw.includes("pool_timeout=")) return raw;
  return `${raw}${raw.includes("?") ? "&" : "?"}pool_timeout=30`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: databaseUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
