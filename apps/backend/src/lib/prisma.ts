import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Cria uma instância do Prisma com o contexto de tenant injetado.
 * Isso seta as variáveis de sessão usadas pelo RLS do Supabase.
 */
export function prismaForTenant(companyId: string, userRole: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRawUnsafe(
              `SELECT set_config('app.current_company_id', $1, TRUE), set_config('app.current_user_role', $2, TRUE)`,
              companyId,
              userRole
            ),
            query(args) as never,
          ]);
          return result;
        },
      },
    },
  });
}
