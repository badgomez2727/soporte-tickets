export type ReadinessResult = { database: 'up' | 'down'; error?: string };

/**
 * Readiness real: pega a la base de datos. Se importa Prisma de forma dinamica
 * para que el proceso pueda arrancar y responder /health aunque la base no este.
 */
export async function checkReadiness(): Promise<ReadinessResult> {
  try {
    const { prisma } = await import('../../shared/prisma.js');
    await prisma.$queryRaw`SELECT 1`;
    return { database: 'up' };
  } catch (error) {
    return { database: 'down', error: error instanceof Error ? error.message : 'desconocido' };
  }
}
