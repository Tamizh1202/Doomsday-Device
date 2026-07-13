import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.project.findFirst({ where: { name: "Surge Coffee" } });
  if (!existing) {
    const project = await prisma.project.create({ data: { name: "Surge Coffee" } });
    console.log(`Created default project: ${project.name} (${project.id})`);
  } else {
    console.log(`Default project already exists: ${existing.name} (${existing.id})`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
