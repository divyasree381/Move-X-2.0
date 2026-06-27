import type { ApiEnvelope, MapSuggestion, MapTravelMode, RouteSummary, SelectedLocation } from "@movex/shared";

export type RoutePoint = Pick<SelectedLocation, "address" | "placeId" | "lat" | "lng" | "source">;

type FetchOptions = RequestInit & {
  skipRefresh?: boolean;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";
const CSRF_COOKIE_NAME = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? "movex_csrf";
const REFRESH_PATH = process.env.NEXT_PUBLIC_AUTH_REFRESH_PATH ?? "/auth/refresh";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly errorCode?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchApi<T>(path: string, init?: FetchOptions): Promise<T> {
  return requestWithRefresh<T>(path, init, false);
}

async function requestWithRefresh<T>(path: string, init: FetchOptions = {}, hasRefreshed: boolean): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, prepareRequest(init));
  const envelope = await parseEnvelope<T>(response);

  if (response.status === 401 && !hasRefreshed && !init.skipRefresh) {
    const refreshed = await refreshSessionOnce();

    if (refreshed) {
      return requestWithRefresh<T>(path, init, true);
    }
  }

  if (!response.ok || !envelope.success) {
    throw new ApiError(envelope.message ?? "Request failed", envelope.statusCode ?? response.status, envelope.errorCode);
  }

  return envelope.data as T;
}

function prepareRequest(init: FetchOptions): RequestInit {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);

    if (csrfToken && !headers.has("x-csrf-token")) {
      headers.set("x-csrf-token", csrfToken);
    }
  }

  const requestInit: RequestInit = { ...init };
  delete (requestInit as FetchOptions).skipRefresh;

  return {
    credentials: "include",
    ...requestInit,
    headers,
  };
}

async function refreshSessionOnce(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}${REFRESH_PATH}`, prepareRequest({ method: "POST", skipRefresh: true }));
    return response.ok;
  } catch {
    return false;
  }
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return {
      success: false,
      statusCode: response.status,
      message: response.statusText || "Invalid API response",
    };
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

export function autocompleteLocations(input: string, bias?: { lat: number; lng: number; radiusMeters?: number }) {
  const params = new URLSearchParams({ input });

  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lng", String(bias.lng));

    if (bias.radiusMeters) {
      params.set("radiusMeters", String(bias.radiusMeters));
    }
  }

  return fetchApi<MapSuggestion[]>(`/maps/autocomplete?${params.toString()}`);
}

export function getPlaceDetails(placeId: string) {
  const params = new URLSearchParams({ placeId });
  return fetchApi<SelectedLocation>(`/maps/place?${params.toString()}`);
}

export function geocodeAddress(address: string) {
  const params = new URLSearchParams({ address });
  return fetchApi<SelectedLocation>(`/maps/geocode?${params.toString()}`);
}

export function reverseGeocode(lat: number, lng: number) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return fetchApi<string>(`/maps/reverse-geocode?${params.toString()}`);
}

export function getRoute(from: RoutePoint, to: RoutePoint, mode: MapTravelMode = "DRIVE") {
  return fetchApi<RouteSummary>("/maps/route", {
    method: "POST",
    body: JSON.stringify({ from, to, mode }),
  });
}
export type StoreListItem = {
  id: string;
  type: "FOOD" | "GROCERY" | "PHARMACY";
  name: string;
  description: string;
  imageUrl?: string | null;
  ratingAverage: string;
  ratingCount: number;
  etaMinutes: number;
  minOrder: string;
  deliveryRadiusKm: string;
  lat: string;
  lng: string;
  isOpen: boolean;
  distanceKm?: number;
};

export type StoreListResponse = {
  items: StoreListItem[];
  nextCursor?: string;
};

export type StoreDetail = StoreListItem & {
  ownerId: string;
  licenseUrl?: string | null;
  approval: string;
  rejectionReason?: string | null;
  openingHours?: unknown;
};

export type MarketplaceMenuItem = {
  id: string;
  storeId: string;
  section: string;
  name: string;
  description: string;
  price: string;
  imageUrl?: string | null;
  tags: string[];
  available: boolean;
  stock: number;
  customizations?: unknown;
};

export type StoreQueryParams = {
  q?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  type?: StoreListItem["type"];
  cursor?: string;
  limit?: number;
};

export function listStores(params: StoreQueryParams = {}) {
  return fetchApi<StoreListResponse>(`/stores${toQueryString(params)}`);
}

export function searchStores(params: StoreQueryParams & { q: string }) {
  return fetchApi<StoreListResponse>(`/stores/search${toQueryString(params)}`);
}

export function getStore(storeId: string) {
  return fetchApi<StoreDetail>(`/stores/${encodeURIComponent(storeId)}`);
}

export function getStoreMenu(storeId: string) {
  return fetchApi<MarketplaceMenuItem[]>(`/stores/${encodeURIComponent(storeId)}/menu`);
}

function toQueryString(params: object): string {
  const query = new URLSearchParams();

  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}
export type StoredObject = {
  key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
};

export type PrescriptionAttachment = {
  status: "UPLOADED" | "VERIFIED" | "REJECTED";
  files: StoredObject[];
  uploadedAt: string;
  note?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  verificationNote?: string | null;
};

export type CartLine = {
  menuItemId: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  section: string;
  quantity: number;
  price: string;
  lineTotal: string;
  available: boolean;
  stock: number;
  customizations?: Record<string, unknown>;
  note?: string | null;
  substitutionPreference?: Record<string, unknown> | null;
};

export type AppliedCoupon = {
  id: string;
  code: string;
  title?: string;
  campaignName?: string | null;
  campaignTag?: string | null;
  serviceType?: string | null;
};

export type CartResponse = {
  store: { id: string; name: string; etaMinutes: number; minOrder: string; isOpen: boolean; type?: StoreListItem["type"] } | null;
  items: CartLine[];
  couponCode: string | null;
  coupon: AppliedCoupon | null;
  couponError: string | null;
  prescription?: PrescriptionAttachment | null;
  pricing: {
    subtotal: string;
    deliveryFee: string;
    discount: string;
    taxes: string;
    total: string;
    minimumRemaining: string;
  };
  updatedAt: string;
};

export type CheckoutAddress = {
  address: string;
  line?: string;
  city?: string;
  state?: string;
  pincode?: string;
  placeId?: string;
  lat: number;
  lng: number;
  source: "autocomplete" | "map-click" | "marker-drag" | "gps" | "typed";
};

export type OrderSummary = {
  id: string;
  customerId: string;
  storeId: string;
  deliveryPartnerId?: string | null;
  store?: { id: string; name: string; imageUrl?: string | null };
  serviceType: string;
  items: unknown;
  status: string;
  timeline: unknown;
  address: unknown;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: string;
  deliveryFee: string;
  discount: string;
  taxes: string;
  total: string;
  couponCode: string | null;
  prepTimeMinutes: number | null;
  storeLocation: unknown;
  rated: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CheckoutResponse = {
  order: OrderSummary;
  paymentRequired: boolean;
  devOtps?: { pickup: string; delivery: string };
};

export function getCart() {
  return fetchApi<CartResponse>("/cart");
}

export function addCartItem(input: { menuItemId: string; quantity: number; customizations?: Record<string, unknown>; note?: string; substitutionPreference?: Record<string, unknown> }) {
  return fetchApi<CartResponse>("/cart/items", { method: "POST", body: JSON.stringify(input) });
}

export function updateCartItemQty(menuItemId: string, quantity: number) {
  return fetchApi<CartResponse>(`/cart/items/${encodeURIComponent(menuItemId)}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(menuItemId: string) {
  return fetchApi<CartResponse>(`/cart/items/${encodeURIComponent(menuItemId)}`, { method: "DELETE" });
}

export function clearCart() {
  return fetchApi<CartResponse>("/cart", { method: "DELETE" });
}

export function applyCartCoupon(code: string) {
  return fetchApi<CartResponse>("/cart/coupon", { method: "POST", body: JSON.stringify({ code }) });
}

export function removeCartCoupon() {
  return fetchApi<CartResponse>("/cart/coupon", { method: "DELETE" });
}
export type RetentionSummary = {
  referralCode: string | null;
  walletBalance: string;
  loyaltyPoints: string;
  referralCredits: string;
  referralsMade: number;
  referralReceived?: { code: string; referrerCreditedAt: string | null; refereeCreditedAt: string | null } | null;
};

export type FavoriteItem = {
  id: string;
  type: "STORE" | "MENU_ITEM";
  targetId: string | null;
  store?: { id: string; name: string; type: string; imageUrl?: string | null; ratingAverage: string; isOpen: boolean } | null;
  menuItem?: { id: string; name: string; price: string; imageUrl?: string | null; store: { id: string; name: string; type: string } } | null;
  createdAt: string;
};

export function retentionSummary() {
  return fetchApi<RetentionSummary>("/users/me/retention");
}

export function applyReferralCode(code: string) {
  return fetchApi<{ applied: boolean; referralId: string; credit: string; walletBalance: string }>("/users/me/referral", { method: "POST", body: JSON.stringify({ code }) });
}

export function listFavorites(params: { type?: "STORE" | "MENU_ITEM" } = {}) {
  return fetchApi<{ items: FavoriteItem[] }>(`/users/me/favorites${toQueryString(params)}`);
}

export function saveFavorite(input: { type: "STORE" | "MENU_ITEM"; targetId: string }) {
  return fetchApi<FavoriteItem>("/users/me/favorites", { method: "POST", body: JSON.stringify(input) });
}

export function removeFavorite(input: { type: "STORE" | "MENU_ITEM"; targetId: string }) {
  return fetchApi<{ removed: true }>("/users/me/favorites", { method: "DELETE", body: JSON.stringify(input) });
}


export function uploadCartPrescription(input: { fileName: string; contentType: string; contentBase64: string; note?: string }) {
  return fetchApi<CartResponse>("/cart/prescription", { method: "POST", body: JSON.stringify(input) });
}
export function checkoutOrder(input: { paymentMethod: "WALLET" | "CASH" | "ONLINE"; idempotencyKey: string; address: CheckoutAddress }) {
  return fetchApi<CheckoutResponse>("/orders/checkout", { method: "POST", body: JSON.stringify(input) });
}

export function listOrders(params: { cursor?: string; limit?: number } = {}) {
  return fetchApi<{ items: OrderSummary[]; nextCursor?: string }>(`/orders${toQueryString(params)}`);
}

export function getOrder(orderId: string) {
  return fetchApi<OrderSummary>(`/orders/${encodeURIComponent(orderId)}`);
}
export type OrderQueueResponse = {
  items: OrderSummary[];
};

export function storeOrderQueue() {
  return fetchApi<OrderQueueResponse>("/orders/store/queue");
}

export function acceptStoreOrder(orderId: string, prepTimeMinutes?: number) {
  return fetchApi<OrderSummary>(`/orders/store/${encodeURIComponent(orderId)}/accept`, {
    method: "POST",
    body: JSON.stringify({ prepTimeMinutes }),
  });
}

export function prepareStoreOrder(orderId: string, prepTimeMinutes?: number) {
  return fetchApi<OrderSummary>(`/orders/store/${encodeURIComponent(orderId)}/prepare`, {
    method: "POST",
    body: JSON.stringify({ prepTimeMinutes }),
  });
}

export function readyStoreOrder(orderId: string, prepTimeMinutes?: number) {
  return fetchApi<OrderSummary>(`/orders/store/${encodeURIComponent(orderId)}/ready`, {
    method: "POST",
    body: JSON.stringify({ prepTimeMinutes }),
  });
}

export function deliveryOrderQueue() {
  return fetchApi<{ items: Array<OrderSummary & { distanceKm?: number }> }>("/orders/delivery/queue");
}

export function acceptDeliveryOrder(orderId: string) {
  return fetchApi<OrderSummary>(`/orders/delivery/${encodeURIComponent(orderId)}/accept`, { method: "POST" });
}

export function pickupOrder(orderId: string, otp: string) {
  return fetchApi<OrderSummary>(`/orders/delivery/${encodeURIComponent(orderId)}/pickup`, {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
}

export function deliverOrder(orderId: string, otp: string) {
  return fetchApi<OrderSummary>(`/orders/delivery/${encodeURIComponent(orderId)}/deliver`, {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
}


export function verifyOrderPrescription(orderId: string, status: "VERIFIED" | "REJECTED", note?: string) {
  return fetchApi<OrderSummary>(`/orders/store/${encodeURIComponent(orderId)}/prescription/verify`, { method: "POST", body: JSON.stringify({ status, note }) });
}

export function proposeOrderSubstitutions(orderId: string, items: Array<{ menuItemId: string; replacementMenuItemId?: string; replacementName: string; quantity: number; priceDelta?: number; reason?: string }>) {
  return fetchApi<OrderSummary>(`/orders/store/${encodeURIComponent(orderId)}/substitutions`, { method: "POST", body: JSON.stringify({ items }) });
}

export function decideOrderSubstitutions(orderId: string, items: Array<{ menuItemId: string; decision: "APPROVED" | "REJECTED" }>) {
  return fetchApi<OrderSummary>(`/orders/${encodeURIComponent(orderId)}/substitutions`, { method: "POST", body: JSON.stringify({ items }) });
}
export function cancelOrder(orderId: string, reason?: string) {
  return fetchApi<OrderSummary>(`/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function rateOrder(orderId: string, rating: number, comment?: string) {
  return fetchApi<OrderSummary>(`/orders/${encodeURIComponent(orderId)}/rating`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
}


export type RidePoint = {
  address: string;
  placeId?: string;
  lat: number;
  lng: number;
  source: "autocomplete" | "map-click" | "marker-drag" | "gps";
};

export type RideEstimate = {
  vehicleType: "BIKE" | "AUTO" | "CAB";
  distanceMeters: number;
  durationSeconds: number;
  distanceKm: string;
  durationMinutes: number;
  baseFare: string;
  surgeMultiplier: string;
  estimatedFare: string;
  polyline: string;
};

export type RideSummary = {
  id: string;
  customerId: string;
  driverId: string | null;
  vehicleType: "BIKE" | "AUTO" | "CAB";
  pickup: unknown;
  drop: unknown;
  status: string;
  estimatedFare: string;
  finalFare: string | null;
  distanceKm: string | null;
  durationMinutes: number | null;
  surgeMultiplier: string;
  paymentMethod: string;
  paymentStatus: string;
  rated: boolean;
  customer?: { id: string; name?: string | null; phoneE164?: string | null } | null;
  driver?: { id: string; name?: string | null; phoneE164?: string | null } | null;
  distanceKmFromDriver?: number;
  createdAt: string;
  updatedAt: string;
};

export type RideCreateResponse = {
  ride: RideSummary;
  offeredDrivers: number;
  devStartOtp?: string;
};

export function estimateRide(input: { pickup: RidePoint; drop: RidePoint; vehicleType: "BIKE" | "AUTO" | "CAB" }) {
  return fetchApi<RideEstimate>("/rides/estimate", { method: "POST", body: JSON.stringify(input) });
}

export function createRide(input: { pickup: RidePoint; drop: RidePoint; vehicleType: "BIKE" | "AUTO" | "CAB"; paymentMethod: "WALLET" | "CASH" | "ONLINE" }) {
  return fetchApi<RideCreateResponse>("/rides", { method: "POST", body: JSON.stringify(input) });
}

export function listRides(params: { cursor?: string; limit?: number } = {}) {
  return fetchApi<{ items: RideSummary[]; nextCursor?: string }>(`/rides${toQueryString(params)}`);
}

export function getRide(rideId: string) {
  return fetchApi<RideSummary>(`/rides/${encodeURIComponent(rideId)}`);
}

export function driverRideQueue() {
  return fetchApi<{ items: Array<RideSummary & { distanceKm: number }> }>("/rides/driver/queue");
}

export function acceptRide(rideId: string) {
  return fetchApi<RideSummary>(`/rides/driver/${encodeURIComponent(rideId)}/accept`, { method: "POST" });
}

export function arriveRide(rideId: string) {
  return fetchApi<RideSummary>(`/rides/driver/${encodeURIComponent(rideId)}/arrive`, { method: "POST" });
}

export function startRide(rideId: string, otp: string) {
  return fetchApi<RideSummary>(`/rides/driver/${encodeURIComponent(rideId)}/start`, { method: "POST", body: JSON.stringify({ otp }) });
}

export function completeRide(rideId: string) {
  return fetchApi<RideSummary>(`/rides/driver/${encodeURIComponent(rideId)}/complete`, { method: "POST" });
}


export type CourierEstimate = RideEstimate;

export type CourierSummary = {
  id: string;
  customerId: string;
  deliveryPartnerId?: string | null;
  pickup: unknown;
  drop: unknown;
  status: string;
  packageDescription: string;
  packageWeightKg: string | null;
  estimatedFare: string;
  finalFare: string | null;
  distanceKm: string | null;
  paymentMethod: string;
  paymentStatus: string;
  rated: boolean;
  customer?: { id: string; name?: string | null; phoneE164?: string | null } | null;
  deliveryPartner?: { id: string; name?: string | null; phoneE164?: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type CourierQueueItem = Omit<CourierSummary, "distanceKm"> & { distanceKm?: number };

export type CourierCreateResponse = {
  courier: CourierSummary;
  offeredPartners: number;
  devOtps?: { pickup: string; delivery: string };
};

export type CourierContactInput = {
  name: string;
  phone: string;
  note?: string;
};

export function estimateCourier(input: { pickup: RidePoint; drop: RidePoint; packageDescription: string; packageWeightKg?: number }) {
  return fetchApi<CourierEstimate>("/couriers/estimate", { method: "POST", body: JSON.stringify(input) });
}

export function createCourier(input: { pickup: RidePoint; drop: RidePoint; packageDescription: string; packageWeightKg?: number; sender: CourierContactInput; recipient: CourierContactInput; paymentMethod: "WALLET" | "CASH" | "ONLINE" }) {
  return fetchApi<CourierCreateResponse>("/couriers", { method: "POST", body: JSON.stringify(input) });
}

export function listCouriers(params: { cursor?: string; limit?: number } = {}) {
  return fetchApi<{ items: CourierSummary[]; nextCursor?: string }>(`/couriers${toQueryString(params)}`);
}

export function getCourier(courierId: string) {
  return fetchApi<CourierSummary>(`/couriers/${encodeURIComponent(courierId)}`);
}

export function deliveryCourierQueue() {
  return fetchApi<{ items: CourierQueueItem[] }>("/couriers/delivery/queue");
}

export function acceptCourier(courierId: string) {
  return fetchApi<CourierSummary>(`/couriers/delivery/${encodeURIComponent(courierId)}/accept`, { method: "POST" });
}

export function arriveCourier(courierId: string) {
  return fetchApi<CourierSummary>(`/couriers/delivery/${encodeURIComponent(courierId)}/arrive`, { method: "POST" });
}

export function pickupCourier(courierId: string, otp: string) {
  return fetchApi<CourierSummary>(`/couriers/delivery/${encodeURIComponent(courierId)}/pickup`, { method: "POST", body: JSON.stringify({ otp }) });
}

export function deliverCourier(courierId: string, otp: string) {
  return fetchApi<CourierSummary>(`/couriers/delivery/${encodeURIComponent(courierId)}/deliver`, { method: "POST", body: JSON.stringify({ otp }) });
}

export function cancelCourier(courierId: string, reason?: string) {
  return fetchApi<CourierSummary>(`/couriers/${encodeURIComponent(courierId)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
}

export function rateCourier(courierId: string, rating: number, comment?: string) {
  return fetchApi<CourierSummary>(`/couriers/${encodeURIComponent(courierId)}/rating`, { method: "POST", body: JSON.stringify({ rating, comment }) });
}

export type HomeServiceCatalogItem = {
  code: string;
  category: string;
  name: string;
  description: string;
  price: string;
  durationMinutes: number;
};

export type HomeServiceEstimate = {
  service: HomeServiceCatalogItem;
  estimatedFare: string;
  durationMinutes: number;
};

export type HomeServiceSummary = {
  id: string;
  customerId: string;
  professionalId?: string | null;
  serviceCategory: string;
  serviceDescription: string;
  address: unknown;
  scheduledFor: string | null;
  status: string;
  estimatedFare: string;
  finalFare: string | null;
  durationMinutes: number | null;
  paymentMethod: string;
  paymentStatus: string;
  rated: boolean;
  customer?: { id: string; name?: string | null; phoneE164?: string | null } | null;
  professional?: { id: string; name?: string | null; phoneE164?: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type HomeServiceQueueItem = HomeServiceSummary & { distanceKm?: number };

export type HomeServiceCreateResponse = {
  booking: HomeServiceSummary;
  offeredProfessionals: number;
  devStartOtp?: string;
};

export function homeServiceCatalog(params: { category?: string } = {}) {
  return fetchApi<{ items: HomeServiceCatalogItem[] }>(`/home-services/catalog${toQueryString(params)}`);
}

export function estimateHomeService(input: { serviceCode: string }) {
  return fetchApi<HomeServiceEstimate>("/home-services/estimate", { method: "POST", body: JSON.stringify(input) });
}

export function createHomeService(input: { serviceCode: string; address: RidePoint; scheduledFor: string; note?: string; paymentMethod: "WALLET" | "CASH" | "ONLINE" }) {
  return fetchApi<HomeServiceCreateResponse>("/home-services", { method: "POST", body: JSON.stringify(input) });
}

export function listHomeServices(params: { cursor?: string; limit?: number } = {}) {
  return fetchApi<{ items: HomeServiceSummary[]; nextCursor?: string }>(`/home-services${toQueryString(params)}`);
}

export function getHomeService(bookingId: string) {
  return fetchApi<HomeServiceSummary>(`/home-services/${encodeURIComponent(bookingId)}`);
}

export function professionalHomeServiceQueue() {
  return fetchApi<{ items: HomeServiceQueueItem[] }>("/home-services/professional/queue");
}

export function acceptHomeService(bookingId: string) {
  return fetchApi<HomeServiceSummary>(`/home-services/professional/${encodeURIComponent(bookingId)}/accept`, { method: "POST" });
}

export function arriveHomeService(bookingId: string) {
  return fetchApi<HomeServiceSummary>(`/home-services/professional/${encodeURIComponent(bookingId)}/arrive`, { method: "POST" });
}

export function startHomeService(bookingId: string, otp: string) {
  return fetchApi<HomeServiceSummary>(`/home-services/professional/${encodeURIComponent(bookingId)}/start`, { method: "POST", body: JSON.stringify({ otp }) });
}

export function completeHomeService(bookingId: string) {
  return fetchApi<HomeServiceSummary>(`/home-services/professional/${encodeURIComponent(bookingId)}/complete`, { method: "POST" });
}

export function cancelHomeService(bookingId: string, reason?: string) {
  return fetchApi<HomeServiceSummary>(`/home-services/${encodeURIComponent(bookingId)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
}

export function rateHomeService(bookingId: string, rating: number, comment?: string) {
  return fetchApi<HomeServiceSummary>(`/home-services/${encodeURIComponent(bookingId)}/rating`, { method: "POST", body: JSON.stringify({ rating, comment }) });
}
export function cancelRide(rideId: string, reason?: string) {
  return fetchApi<RideSummary>(`/rides/${encodeURIComponent(rideId)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
}

export function rateRide(rideId: string, rating: number, comment?: string) {
  return fetchApi<RideSummary>(`/rides/${encodeURIComponent(rideId)}/rating`, { method: "POST", body: JSON.stringify({ rating, comment }) });
}
export type RealtimeMessage = {
  id: string;
  type: string;
  topic: string;
  payload: unknown;
  createdAt: string;
};

export function realtimeSubscribeUrl(topic: string) {
  const params = new URLSearchParams({ topic });
  return `${API_BASE_URL}/realtime/subscribe?${params.toString()}`;
}
export function setPartnerOnline(isOnline: boolean) {
  return fetchApi<unknown>("/users/me/online", { method: "POST", body: JSON.stringify({ isOnline }) });
}

export function writePartnerLocation(lat: number, lng: number, vehicleType?: "BIKE" | "AUTO" | "CAB") {
  return fetchApi<{ ok: true }>("/users/me/location", { method: "POST", body: JSON.stringify({ lat, lng, vehicleType }) });
}
export type PartnerShift = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartnerPeriodSummary = {
  period: { from: string; to: string };
  ledger: {
    grossCredits: string;
    debits: string;
    net: string;
    unsettled: string;
    byType: Record<string, string>;
    entryCount: number;
    entryIds: string[];
    formula: string;
  };
  payouts: {
    total: string;
    byStatus: Record<string, string>;
    items: Array<{ id: string; amount: string; status: string; reference?: string | null; createdAt: string; updatedAt: string }>;
  };
  online: {
    seconds: number;
    sessions: Array<{ id: string; startedAt: string; endedAt: string | null; lastHeartbeatAt: string | null }>;
  };
};

export type PartnerRoutePlan = {
  mode: "STUB";
  objective: "DISTANCE" | "ETA" | "PAYOUT";
  maxStops: number;
  stops: Array<{ id: string; type: "ORDER" | "RIDE" | "COURIER" | "HOME_SERVICE"; lat?: number; lng?: number }>;
  notes: string[];
};

export type PartnerOpsSummary = {
  selected: PartnerPeriodSummary;
  daily: PartnerPeriodSummary;
  weekly: PartnerPeriodSummary;
  shifts: PartnerShift[];
  routePlan: PartnerRoutePlan;
};

export function partnerOpsSummary(params: { from?: string; to?: string } = {}) {
  return fetchApi<PartnerOpsSummary>(`/users/me/partner-ops${toQueryString(params)}`);
}

export function createPartnerShift(input: { startsAt: string; endsAt: string; note?: string }) {
  return fetchApi<PartnerShift>("/users/me/partner-ops/shifts", { method: "POST", body: JSON.stringify(input) });
}

export function cancelPartnerShift(shiftId: string) {
  return fetchApi<PartnerShift>(`/users/me/partner-ops/shifts/${encodeURIComponent(shiftId)}`, { method: "DELETE" });
}

export function partnerRoutePlan(input: { maxStops?: number; objective?: "DISTANCE" | "ETA" | "PAYOUT" } = {}) {
  return fetchApi<PartnerRoutePlan>("/users/me/partner-ops/route-plan", { method: "POST", body: JSON.stringify(input) });
}
export type OpsUser = {
  id: string;
  role: string;
  phoneE164?: string | null;
  email?: string | null;
  name?: string | null;
  isOnline: boolean;
  partnerApproval: string;
  rejectionReason?: string | null;
  isBanned?: boolean;
  mfaEnabled?: boolean;
  lastSeenAt?: string | null;
};

export type CurrentUser = {
  user: OpsUser;
};

export function currentUser() {
  return fetchApi<CurrentUser>("/auth/me");
}
export type OpsCoupon = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  serviceType?: string | null;
  campaignName?: string | null;
  campaignTag?: string | null;
  firstOrderOnly: boolean;
  metadata?: Record<string, unknown> | null;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: string;
  maxDiscount?: string | null;
  minOrderValue?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  usageCount: number;
  perUserLimit?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertCouponInput = {
  code: string;
  title: string;
  description?: string | null;
  serviceType?: string | null;
  campaignName?: string | null;
  campaignTag?: string | null;
  firstOrderOnly?: boolean;
  metadata?: Record<string, unknown> | null;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  isActive?: boolean;
};

export type OpsConfig = {
  key: string;
  value: unknown;
  description?: string | null;
  isSecret: boolean;
  updatedAt: string;
};

export type OpsTicket = {
  id: string;
  userId?: string | null;
  assignedToId?: string | null;
  subject: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  referenceType?: string | null;
  referenceId?: string | null;
  metadata?: unknown;
  messages?: Array<{ id: string; actorId: string; actorRole: string; message: string; createdAt: string }>;
  user?: { id: string; name?: string | null; phoneE164?: string | null; email?: string | null } | null;
  assignedTo?: { id: string; name?: string | null; email?: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type OpsAuditLog = {
  id: string;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  actor?: { id: string; name?: string | null; email?: string | null; role: string } | null;
};

export function adminUsers(params: { cursor?: string; limit?: number; role?: string } = {}) {
  return fetchApi<{ items: OpsUser[]; nextCursor?: string }>(`/users/admin${toQueryString(params)}`);
}

export function banUser(userId: string, reason?: string) {
  return fetchApi<OpsUser>(`/users/admin/${encodeURIComponent(userId)}/ban`, { method: "POST", body: JSON.stringify({ reason }) });
}

export function unbanUser(userId: string) {
  return fetchApi<OpsUser>(`/users/admin/${encodeURIComponent(userId)}/unban`, { method: "POST" });
}

export function pendingPartners(params: { cursor?: string; limit?: number } = {}) {
  return fetchApi<{ items: OpsUser[]; nextCursor?: string }>(`/users/admin/partners/pending${toQueryString(params)}`);
}

export function reviewPartner(userId: string, approval: "APPROVED" | "REJECTED", reason?: string) {
  return fetchApi<OpsUser>(`/users/admin/partners/${encodeURIComponent(userId)}/review`, { method: "POST", body: JSON.stringify({ approval, reason }) });
}

export function pendingStores(params: { cursor?: string; limit?: number } = {}) {
  return fetchApi<{ items: StoreDetail[]; nextCursor?: string }>(`/stores/admin/pending${toQueryString(params)}`);
}

export function reviewStore(storeId: string, approval: "APPROVED" | "REJECTED", rejectionReason?: string) {
  return fetchApi<StoreDetail>(`/stores/admin/${encodeURIComponent(storeId)}/review`, { method: "POST", body: JSON.stringify({ approval, rejectionReason }) });
}

export function suspendStore(storeId: string) {
  return fetchApi<StoreDetail>(`/stores/admin/${encodeURIComponent(storeId)}/suspend`, { method: "POST" });
}

export function opsCoupons(params: { cursor?: string; limit?: number; q?: string; serviceType?: string; isActive?: boolean } = {}) {
  return fetchApi<{ items: OpsCoupon[]; nextCursor?: string }>(`/ops/coupons${toQueryString(params)}`);
}

export function createCoupon(input: UpsertCouponInput) {
  return fetchApi<OpsCoupon>("/ops/coupons", { method: "POST", body: JSON.stringify(input) });
}

export function updateCoupon(couponId: string, input: UpsertCouponInput) {
  return fetchApi<OpsCoupon>(`/ops/coupons/${encodeURIComponent(couponId)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deactivateCoupon(couponId: string) {
  return fetchApi<OpsCoupon>(`/ops/coupons/${encodeURIComponent(couponId)}`, { method: "DELETE" });
}

export function opsConfig(params: { cursor?: string; limit?: number; q?: string } = {}) {
  return fetchApi<{ items: OpsConfig[]; nextCursor?: string }>(`/ops/config${toQueryString(params)}`);
}

export function upsertConfig(key: string, input: { value: Record<string, unknown>; description?: string; isSecret?: boolean }) {
  return fetchApi<OpsConfig>(`/ops/config/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify(input) });
}

export function opsTickets(params: { cursor?: string; limit?: number; status?: string; priority?: string; referenceType?: string; referenceId?: string } = {}) {
  return fetchApi<{ items: OpsTicket[]; nextCursor?: string }>(`/ops/support/tickets${toQueryString(params)}`);
}

export function createTicket(input: { userId?: string; subject: string; message: string; priority?: string; referenceType?: string; referenceId?: string }) {
  return fetchApi<OpsTicket>("/ops/support/tickets", { method: "POST", body: JSON.stringify(input) });
}

export function getTicket(ticketId: string) {
  return fetchApi<OpsTicket>(`/ops/support/tickets/${encodeURIComponent(ticketId)}`);
}

export function updateTicket(ticketId: string, input: { status?: string; priority?: string; assignedToId?: string }) {
  return fetchApi<OpsTicket>(`/ops/support/tickets/${encodeURIComponent(ticketId)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function addTicketMessage(ticketId: string, message: string) {
  return fetchApi<OpsTicket>(`/ops/support/tickets/${encodeURIComponent(ticketId)}/messages`, { method: "POST", body: JSON.stringify({ message }) });
}

export function opsAudit(params: { cursor?: string; limit?: number; actorId?: string; action?: string; entityType?: string } = {}) {
  return fetchApi<{ items: OpsAuditLog[]; nextCursor?: string }>(`/ops/audit${toQueryString(params)}`);
}


export type CancellationPolicy = {
  serviceType: string;
  disclosure: string;
  rules: Array<{ stage: string; window: string; fee: string; refund: string; note: string }>;
};

export type OpsDispute = {
  id: string;
  supportTicketId: string;
  customerId: string;
  partnerId?: string | null;
  referenceType: "ORDER" | "RIDE" | "COURIER" | "HOME_SERVICE";
  referenceId: string;
  reason: "NOT_DELIVERED" | "DAMAGED_OR_INCOMPLETE" | "OVERCHARGED" | "SAFETY_OR_BEHAVIOR" | "CANCELLATION_FEE" | "OTHER";
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  resolution?: "REFUND" | "WALLET_CREDIT" | "PARTNER_CREDIT" | "NO_ACTION" | "OTHER" | null;
  summary: string;
  customerNote?: string | null;
  partnerNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; role: string; name?: string | null; email?: string | null; phoneE164?: string | null } | null;
  partner?: { id: string; role: string; name?: string | null; email?: string | null; phoneE164?: string | null } | null;
  supportTicket?: OpsTicket;
  actions: Array<{ id: string; actorId?: string | null; actorRole?: string | null; action: string; note?: string | null; statusFrom?: string | null; statusTo?: string | null; resolution?: string | null; metadata?: unknown; createdAt: string }>;
};

export function cancellationPolicy(params: { serviceType?: string; stage?: string } = {}) {
  return fetchApi<CancellationPolicy>(`/trust/cancellation-policy${toQueryString(params)}`);
}

export function openDispute(input: { referenceType: OpsDispute["referenceType"]; referenceId: string; reason: OpsDispute["reason"]; summary: string; customerNote?: string }) {
  return fetchApi<OpsDispute>("/trust/disputes", { method: "POST", body: JSON.stringify(input) });
}

export function opsDisputes(params: { cursor?: string; limit?: number; status?: string; customerId?: string; partnerId?: string; referenceType?: string; referenceId?: string; reason?: string } = {}) {
  return fetchApi<{ items: OpsDispute[]; nextCursor?: string }>(`/ops/disputes${toQueryString(params)}`);
}

export function getOpsDispute(disputeId: string) {
  return fetchApi<OpsDispute>(`/ops/disputes/${encodeURIComponent(disputeId)}`);
}

export function actionOpsDispute(disputeId: string, input: { action: string; note?: string; status?: string; resolution?: string }) {
  return fetchApi<OpsDispute>(`/ops/disputes/${encodeURIComponent(disputeId)}/actions`, { method: "POST", body: JSON.stringify(input) });
}

export function resolveOpsDispute(disputeId: string, input: { action?: string; note?: string; status?: string; resolution: string }) {
  return fetchApi<OpsDispute>(`/ops/disputes/${encodeURIComponent(disputeId)}/resolve`, { method: "POST", body: JSON.stringify(input) });
}
export function createRefund(input: { referenceType: "ORDER" | "RIDE" | "COURIER" | "HOME_SERVICE" | "WALLET_TOPUP"; referenceId: string; reason?: string }) {
  return fetchApi<unknown>("/payments/refunds", { method: "POST", body: JSON.stringify(input) });
}
export type FinanceLedgerEntry = {
  id: string;
  userId: string;
  userRole: string;
  type: string;
  amount: string;
  description: string;
  paymentMethod?: string | null;
  orderId?: string | null;
  rideId?: string | null;
  isSettled: boolean;
  paymentId?: string | null;
  createdAt: string;
  user?: { id: string; role: string; name?: string | null; email?: string | null; phoneE164?: string | null } | null;
};

export type FinancePayout = {
  id: string;
  userId: string;
  userRole: string;
  amount: string;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED";
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  reference?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; role: string; name?: string | null; email?: string | null; phoneE164?: string | null } | null;
};


export type FinanceReconciliationReport = {
  id: string;
  provider: string;
  status: "CLEAR" | "HAS_MISMATCHES";
  from: string;
  to: string;
  providerTotal: string;
  ledgerTotal: string;
  mismatchCount: number;
  matchedCount: number;
  rows: unknown;
  mismatches: Array<Record<string, unknown>> | unknown;
  createdAt: string;
};
export type FinanceInvoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  recipient: unknown;
  type: "ORDER" | "RIDE" | "COURIER" | "HOME_SERVICE";
  referenceId: string;
  amount: string;
  taxBreakdown: unknown;
  status: "DRAFT" | "ISSUED" | "PAID" | "VOID";
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; role: string; name?: string | null; email?: string | null; phoneE164?: string | null } | null;
};

export function financeLedger(params: { cursor?: string; limit?: number; userId?: string; userRole?: string; type?: string; paymentMethod?: string; isSettled?: boolean; orderId?: string; rideId?: string } = {}) {
  return fetchApi<{ items: FinanceLedgerEntry[]; nextCursor?: string }>(`/finance/ledger${toQueryString(params)}`);
}

export function financeLedgerEntry(entryId: string) {
  return fetchApi<FinanceLedgerEntry>(`/finance/ledger/${encodeURIComponent(entryId)}`);
}

export function financeWalletAdjustment(input: { userId: string; amount: number; description: string; idempotencyKey?: string }) {
  return fetchApi<{ entry: FinanceLedgerEntry; balance: string; duplicate: boolean }>("/finance/wallet-adjustments", { method: "POST", body: JSON.stringify(input) });
}

export function financePayoutSweep(input: { userId?: string; userRole?: string; idempotencyKey?: string } = {}) {
  return fetchApi<{ duplicate: boolean; items: FinancePayout[] }>("/finance/payout-sweeps", { method: "POST", body: JSON.stringify(input) });
}

export function financePayouts(params: { cursor?: string; limit?: number; userId?: string; userRole?: string; status?: string } = {}) {
  return fetchApi<{ items: FinancePayout[]; nextCursor?: string }>(`/finance/payouts${toQueryString(params)}`);
}

export function markFinancePayout(payoutId: string, input: { status?: string; reference?: string } = {}) {
  return fetchApi<FinancePayout>(`/finance/payouts/${encodeURIComponent(payoutId)}`, { method: "PATCH", body: JSON.stringify(input) });
}


export function financeReconciliationReports(params: { cursor?: string; limit?: number; status?: string } = {}) {
  return fetchApi<{ items: FinanceReconciliationReport[]; nextCursor?: string }>(`/finance/reconciliation${toQueryString(params)}`);
}

export function generateFinanceReconciliation(input: { from: string; to: string; providerRows?: Array<Record<string, unknown>> }) {
  return fetchApi<FinanceReconciliationReport>("/finance/reconciliation", { method: "POST", body: JSON.stringify(input) });
}
export function financeInvoices(params: { cursor?: string; limit?: number; customerId?: string; type?: string; referenceId?: string; status?: string } = {}) {
  return fetchApi<{ items: FinanceInvoice[]; nextCursor?: string }>(`/finance/invoices${toQueryString(params)}`);
}

export function generateFinanceInvoice(input: { referenceType: FinanceInvoice["type"]; referenceId: string; recipient?: Record<string, unknown>; taxBreakdown?: Record<string, unknown> }) {
  return fetchApi<FinanceInvoice>("/finance/invoices", { method: "POST", body: JSON.stringify(input) });
}

export function getFinanceInvoice(invoiceId: string) {
  return fetchApi<FinanceInvoice>(`/finance/invoices/${encodeURIComponent(invoiceId)}`);
}

export function financeInvoiceHtmlUrl(invoiceId: string) {
  return `${API_BASE_URL}/finance/invoices/${encodeURIComponent(invoiceId)}/html`;
}
export type PlatformAnalyticsRow = {
  id: string;
  date: string;
  scope: string;
  ordersCount: number;
  ridesCount: number;
  courierCount: number;
  homeServiceCount: number;
  gmv: string;
  activePartners: number;
  refreshedAt: string;
};

export type PlatformAnalyticsResponse = {
  from: string;
  to: string;
  totals: {
    ordersCount: number;
    ridesCount: number;
    courierCount: number;
    homeServiceCount: number;
    gmv: string;
    activePartners: number;
  };
  rows: PlatformAnalyticsRow[];
};

export type PlatformFeatureFlag = {
  key: string;
  description?: string | null;
  enabled: boolean;
  rollout: unknown;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function platformAnalytics(params: { from?: string; to?: string; scope?: string } = {}) {
  return fetchApi<PlatformAnalyticsResponse>(`/platform/analytics${toQueryString(params)}`);
}

export function refreshPlatformAnalytics(input: { from?: string; to?: string; scope?: string } = {}) {
  return fetchApi<{ upserted: number; from: string; to: string }>("/platform/analytics/refresh", { method: "POST", body: JSON.stringify(input) });
}

export function platformFeatureFlags(params: { cursor?: string; limit?: number; q?: string } = {}) {
  return fetchApi<{ items: PlatformFeatureFlag[]; nextCursor?: string }>(`/platform/feature-flags${toQueryString(params)}`);
}

export function upsertPlatformFeatureFlag(key: string, input: { enabled: boolean; description?: string; rollout?: Record<string, unknown> }) {
  return fetchApi<PlatformFeatureFlag>(`/platform/feature-flags/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify(input) });
}

export function requestPlatformSearchRebuild(input: { scope?: string } = {}) {
  return fetchApi<{ accepted: boolean; eventId: string }>("/platform/search/rebuild", { method: "POST", body: JSON.stringify(input) });
}

