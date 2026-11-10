import { PrismaClient } from "@prisma/client";
import { DEMO_DEAL_ID, resetDemoDeal } from "../lib/demo-deal";

const prisma = new PrismaClient();

async function main() {
  const deal = await resetDemoDeal(prisma);
  console.log(`Seeded deal "${deal.title}" -> /deals/${DEMO_DEAL_ID}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
