const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

async function test() {
  const pool = new Pool({ connectionString: "postgresql://movex:movex@localhost:5432/movex?schema=public" });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  try {
    const user = await prisma.user.findFirst({ where: { role: "RESTAURANT" } });
    console.log("Success", user);
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
test();
