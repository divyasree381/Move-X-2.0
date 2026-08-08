const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

async function test() {
  const pool = new Pool({ connectionString: "postgresql://postgres.fyswpnsonhcnolmmshpb:Nighaitecch%2120@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres" });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.findFirst({
      where: {
        phoneE164: "+918019971381",
        role: "RESTAURANT"
      }
    });
    console.log("Success", user);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
test();
