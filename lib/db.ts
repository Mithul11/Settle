import { PrismaClient } from "@prisma/client";

// One PrismaClient per process. In dev, Next.js hot reload would otherwise
// create a new client (and a new connection pool) on every change.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
