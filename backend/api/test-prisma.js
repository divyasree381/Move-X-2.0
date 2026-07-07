const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        phoneE164: "+918019971381",
        role: "RESTAURANT"
      }
    });
    console.log(user);
  } catch (err) {
    console.error(err);
  }
  await prisma.$disconnect();
}
test();
