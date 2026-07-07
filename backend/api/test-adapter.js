const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

async function test() {
  const adapter = new PrismaPg("postgresql://movex:movex@localhost:5432/movex?schema=public");
  const prisma = new PrismaClient({ adapter });
  
  try {
    await prisma.user.findFirst({ where: { role: "RESTAURANT" } });
    console.log("Success");
  } catch (err) {
    console.error("Failed:", err);
  }
}
test();
