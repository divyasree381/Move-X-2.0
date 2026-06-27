import type { Page, Route } from "@playwright/test";

const store = {
  id: "store_food_1",
  type: "FOOD",
  name: "MoveX Kitchen",
  description: "Fast local meals",
  imageUrl: null,
  ratingAverage: "4.6",
  ratingCount: 128,
  etaMinutes: 18,
  minOrder: "99.00",
  deliveryRadiusKm: "8.00",
  lat: "12.9784000",
  lng: "77.6408000",
  isOpen: true,
  distanceKm: 1.2,
};

const menuItem = {
  id: "item_biryani",
  storeId: store.id,
  section: "Meals",
  name: "Paneer Biryani",
  description: "Aromatic rice with paneer",
  price: "199.00",
  imageUrl: null,
  tags: ["biryani"],
  available: true,
  stock: 10,
  customizations: {},
};

const emptyCart = {
  store: null,
  items: [],
  couponCode: null,
  coupon: null,
  couponError: null,
  pricing: { subtotal: "0.00", deliveryFee: "0.00", discount: "0.00", taxes: "0.00", total: "0.00", minimumRemaining: "0.00" },
  updatedAt: new Date().toISOString(),
};

const filledCart = {
  store: { id: store.id, name: store.name, etaMinutes: store.etaMinutes, minOrder: store.minOrder, isOpen: true, type: "FOOD" },
  items: [{ ...menuItem, quantity: 1, lineTotal: "199.00" }],
  couponCode: null,
  coupon: null,
  couponError: null,
  pricing: { subtotal: "199.00", deliveryFee: "25.00", discount: "0.00", taxes: "9.00", total: "233.00", minimumRemaining: "0.00" },
  updatedAt: new Date().toISOString(),
};

export async function installApiMocks(page: Page) {
  await page.route("**/api/v1/**", async (route) => route.fulfill(jsonEnvelope(await responseFor(route))));
}

export async function loginAs(page: Page, role: "CUSTOMER" | "DRIVER" | "RESTAURANT" = "CUSTOMER") {
  await page.context().addCookies([
    { name: "has_session", value: "1", domain: "127.0.0.1", path: "/" },
    { name: "movex_role", value: role, domain: "127.0.0.1", path: "/" },
  ]);
}

async function responseFor(route: Route): Promise<unknown> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace("/api/v1", "");

  if (path === "/cart" && request.method() === "GET") return emptyCart;
  if (path === "/cart/items" && request.method() === "POST") return filledCart;
  if (path.startsWith("/stores/search") || path === "/stores") return { items: [store] };
  if (path === `/stores/${store.id}`) return { ...store, ownerId: "restaurant_1", approval: "APPROVED", rejectionReason: null, openingHours: {} };
  if (path === `/stores/${store.id}/menu`) return [menuItem];
  if (path === "/maps/geocode") return { address: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408, source: "typed" };
  if (path === "/rides/estimate") return { vehicleType: "BIKE", distanceMeters: 4200, durationSeconds: 900, distanceKm: "4.20", durationMinutes: 15, baseFare: "40.00", surgeMultiplier: "1.00", estimatedFare: "96.00", polyline: "encoded" };
  if (path === "/rides" && request.method() === "POST") return { ride: { id: "ride_1", customerId: "customer_1", driverId: null, vehicleType: "BIKE", pickup: {}, drop: {}, status: "REQUESTED", estimatedFare: "96.00", finalFare: null, distanceKm: "4.20", durationMinutes: 15, surgeMultiplier: "1.00", paymentMethod: "CASH", paymentStatus: "PENDING", rated: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, offeredDrivers: 2, devStartOtp: "123456" };
  if (path === "/rides/driver/queue") return { items: [{ id: "ride_1", customerId: "customer_1", driverId: null, vehicleType: "BIKE", pickup: { address: "Indiranagar" }, drop: { address: "MG Road" }, status: "REQUESTED", estimatedFare: "96.00", finalFare: null, distanceKm: 2.1, durationMinutes: 15, surgeMultiplier: "1.00", paymentMethod: "CASH", paymentStatus: "PENDING", rated: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
  if (path === "/users/me/online") return { ok: true };
  if (path === "/users/me/partner-ops") return { selected: period(), daily: period(), weekly: period(), shifts: [], routePlan: { mode: "STUB", objective: "ETA", maxStops: 6, stops: [], notes: [] } };
  if (path === "/trust/cancellation-policy") return { serviceType: "RIDE", disclosure: "Transparent cancellation rules", rules: [] };

  return {};
}

function period() {
  return { period: { from: new Date().toISOString(), to: new Date().toISOString() }, ledger: { grossCredits: "0.00", debits: "0.00", net: "0.00", unsettled: "0.00", byType: {}, entryCount: 0, entryIds: [], formula: "credits - debits" }, payouts: { total: "0.00", byStatus: {}, items: [] }, online: { seconds: 0, sessions: [] } };
}

function jsonEnvelope(data: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, statusCode: 200, data }),
  };
}
