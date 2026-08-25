import { prisma } from "@/lib/prisma";

/**
 * Level 3 — fully automatic. Runs the instant a contract is signed; there's
 * nothing here a human needs to approve (just row creation), unlike every
 * later step in the SEO pipeline.
 */
export async function createProjectForCustomer(customerId: string) {
  return prisma.project.upsert({
    where: { customerId },
    update: {},
    create: { customerId },
  });
}
