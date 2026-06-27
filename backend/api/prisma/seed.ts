import { PrismaPg } from "@prisma/adapter-pg";
import { AdminType, PartnerApproval, PrismaClient, StoreType, UserRole } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the Prisma seed script.");
}

const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });

const seedUsers = [
  {
    id: "seed-user-customer",
    role: UserRole.CUSTOMER,
    phoneE164: "+919900000001",
    email: "customer@movex.local",
    name: "MoveX Customer",
    partnerApproval: PartnerApproval.NONE,
  },
  {
    id: "seed-user-restaurant",
    role: UserRole.RESTAURANT,
    phoneE164: "+919900000002",
    email: "restaurant@movex.local",
    name: "MoveX Restaurant Partner",
    partnerApproval: PartnerApproval.APPROVED,
  },
  {
    id: "seed-user-delivery",
    role: UserRole.DELIVERY,
    phoneE164: "+919900000003",
    email: "delivery@movex.local",
    name: "MoveX Delivery Partner",
    partnerApproval: PartnerApproval.APPROVED,
  },
  {
    id: "seed-user-driver",
    role: UserRole.DRIVER,
    phoneE164: "+919900000004",
    email: "driver@movex.local",
    name: "MoveX Driver",
    partnerApproval: PartnerApproval.APPROVED,
  },
  {
    id: "seed-user-support",
    role: UserRole.SUPPORT,
    phoneE164: "+919900000005",
    email: "support@movex.local",
    name: "MoveX Support",
    partnerApproval: PartnerApproval.NONE,
  },
  {
    id: "seed-user-finance",
    role: UserRole.FINANCE,
    phoneE164: "+919900000006",
    email: "finance@movex.local",
    name: "MoveX Finance",
    partnerApproval: PartnerApproval.NONE,
  },
  {
    id: "seed-user-admin",
    role: UserRole.ADMIN,
    adminType: AdminType.ADMIN,
    phoneE164: "+919900000007",
    email: "admin@movex.local",
    name: "MoveX Admin",
    partnerApproval: PartnerApproval.NONE,
  },
  {
    id: "seed-user-super-admin",
    role: UserRole.SUPER_ADMIN,
    adminType: AdminType.SUPER_ADMIN,
    phoneE164: "+919900000008",
    email: "superadmin@movex.local",
    name: "MoveX Super Admin",
    partnerApproval: PartnerApproval.NONE,
  },
] as const;

const stores = [
  {
    id: "seed-store-biryani-house",
    ownerId: "seed-user-restaurant",
    type: StoreType.FOOD,
    name: "Biryani House",
    description: "Hyderabadi biryani and kebabs.",
    etaMinutes: 30,
    minOrder: "149.00",
    deliveryRadiusKm: "6.50",
    lat: "12.9715990",
    lng: "77.5945660",
    openingHours: {
      mon: [{ open: "10:00", close: "23:00" }],
      tue: [{ open: "10:00", close: "23:00" }],
      wed: [{ open: "10:00", close: "23:00" }],
      thu: [{ open: "10:00", close: "23:00" }],
      fri: [{ open: "10:00", close: "23:30" }],
      sat: [{ open: "10:00", close: "23:30" }],
      sun: [{ open: "10:00", close: "23:00" }],
    },
  },
  {
    id: "seed-store-daily-mart",
    ownerId: "seed-user-restaurant",
    type: StoreType.GROCERY,
    name: "Daily Mart",
    description: "Everyday groceries and household essentials.",
    etaMinutes: 20,
    minOrder: "99.00",
    deliveryRadiusKm: "4.00",
    lat: "12.9351929",
    lng: "77.6244807",
    openingHours: {
      mon: [{ open: "07:00", close: "22:00" }],
      tue: [{ open: "07:00", close: "22:00" }],
      wed: [{ open: "07:00", close: "22:00" }],
      thu: [{ open: "07:00", close: "22:00" }],
      fri: [{ open: "07:00", close: "22:00" }],
      sat: [{ open: "07:00", close: "22:00" }],
      sun: [{ open: "08:00", close: "21:00" }],
    },
  },
  {
    id: "seed-store-care-pharmacy",
    ownerId: "seed-user-restaurant",
    type: StoreType.PHARMACY,
    name: "Care Pharmacy",
    description: "Medicines, wellness, and pharmacist-reviewed orders.",
    etaMinutes: 25,
    minOrder: "49.00",
    deliveryRadiusKm: "5.00",
    lat: "12.9698190",
    lng: "77.7499720",
    openingHours: {
      mon: [{ open: "08:00", close: "23:00" }],
      tue: [{ open: "08:00", close: "23:00" }],
      wed: [{ open: "08:00", close: "23:00" }],
      thu: [{ open: "08:00", close: "23:00" }],
      fri: [{ open: "08:00", close: "23:00" }],
      sat: [{ open: "08:00", close: "23:00" }],
      sun: [{ open: "09:00", close: "21:00" }],
    },
  },
] as const;

const menuItems = [
  {
    id: "seed-menu-chicken-biryani",
    storeId: "seed-store-biryani-house",
    section: "Biryani",
    name: "Chicken Biryani",
    description: "Aromatic basmati rice with slow-cooked chicken.",
    price: "249.00",
    tags: ["spicy", "best-seller"],
    customizations: {
      spiceLevel: ["medium", "hot"],
      addOns: ["raita", "extra salan"],
    },
  },
  {
    id: "seed-menu-paneer-tikka",
    storeId: "seed-store-biryani-house",
    section: "Starters",
    name: "Paneer Tikka",
    description: "Charred paneer cubes with peppers and onions.",
    price: "199.00",
    tags: ["vegetarian"],
    customizations: {},
  },
  {
    id: "seed-menu-basmati-rice",
    storeId: "seed-store-daily-mart",
    section: "Staples",
    name: "Basmati Rice 1kg",
    description: "Premium aged basmati rice pack.",
    price: "145.00",
    tags: ["staples"],
    customizations: {},
  },
  {
    id: "seed-menu-toned-milk",
    storeId: "seed-store-daily-mart",
    section: "Dairy",
    name: "Toned Milk 1L",
    description: "Fresh toned milk pouch.",
    price: "62.00",
    tags: ["dairy"],
    customizations: {},
  },
  {
    id: "seed-menu-paracetamol",
    storeId: "seed-store-care-pharmacy",
    section: "OTC",
    name: "Paracetamol 500mg Strip",
    description: "Fever and pain relief tablets.",
    price: "32.00",
    tags: ["medicine", "otc"],
    customizations: {},
  },
  {
    id: "seed-menu-vitamin-d3",
    storeId: "seed-store-care-pharmacy",
    section: "Wellness",
    name: "Vitamin D3 Capsules",
    description: "Weekly vitamin D3 supplement pack.",
    price: "128.00",
    tags: ["wellness"],
    customizations: {},
  },
] as const;

const homeServiceCatalogItems = [
  {
    code: "AC_SERVICE",
    category: "Appliance",
    name: "AC service",
    description: "Jet-clean indoor unit, filter wash, and cooling check.",
    price: "699.00",
    durationMinutes: 60,
    sortOrder: 10,
  },
  {
    code: "PLUMBING_VISIT",
    category: "Plumbing",
    name: "Plumbing visit",
    description: "Leak, tap, flush, and drainage inspection with minor fixes.",
    price: "349.00",
    durationMinutes: 45,
    sortOrder: 20,
  },
  {
    code: "DEEP_CLEAN",
    category: "Cleaning",
    name: "Bathroom deep clean",
    description: "Single bathroom deep cleaning with stain and scale removal.",
    price: "599.00",
    durationMinutes: 75,
    sortOrder: 30,
  },
  {
    code: "ELECTRICIAN_VISIT",
    category: "Electrical",
    name: "Electrician visit",
    description: "Switch, fan, light, and wiring diagnostics for one visit.",
    price: "399.00",
    durationMinutes: 45,
    sortOrder: 40,
  },
] as const;
async function main() {
  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: user,
      create: user,
    });
  }

  for (const store of stores) {
    await prisma.store.upsert({
      where: { id: store.id },
      update: {
        ...store,
        approval: PartnerApproval.APPROVED,
        isOpen: true,
      },
      create: {
        ...store,
        approval: PartnerApproval.APPROVED,
        isOpen: true,
      },
    });

    await prisma.$executeRaw`
      UPDATE "Store"
      SET "location" = ST_SetSRID(ST_MakePoint(${store.lng}::double precision, ${store.lat}::double precision), 4326)::geography
      WHERE "id" = ${store.id}
    `;
  }

  for (const item of menuItems) {
    const menuItemData = {
      ...item,
      tags: [...item.tags],
      available: true,
      stock: -1,
    };

    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: menuItemData,
      create: menuItemData,
    });
  }
  for (const item of homeServiceCatalogItems) {
    await prisma.homeServiceCatalogItem.upsert({
      where: { code: item.code },
      update: { ...item, isActive: true },
      create: { ...item, isActive: true },
    });
  }

  await prisma.systemConfig.upsert({
    where: { key: "platform.country" },
    update: { value: "IN", description: "Default market country code." },
    create: { key: "platform.country", value: "IN", description: "Default market country code." },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
