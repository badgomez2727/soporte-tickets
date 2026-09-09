import { PrismaClient } from '@prisma/client';

// Instancia unica: evita agotar el pool de conexiones al recargar en desarrollo.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
