import type { DietaryType } from "@/lib/dietary";

export type PublicStoreType = "FOOD" | "GROCERY" | "PHARMACY";

export type PublicMenuItem = {
  name: string;
  section: string;
  description: string;
  price: number;
  badge?: string;
  dietaryType?: DietaryType;
};

export type PublicStore = {
  id: string;
  type: PublicStoreType;
  name: string;
  area: string;
  city: string;
  description: string;
  imageUrl: string;
  rating: number;
  ratingCount: number;
  etaMinutes: number;
  minOrder: number;
  distanceKm: number;
  tags: string[];
  isOpen: boolean;
  menu: PublicMenuItem[];
};

export type PublicOffer = {
  id: string;
  title: string;
  description: string;
  service: "Food" | "Grocery" | "Pharmacy" | "Rides" | "Courier" | "Home services";
  plannedBenefit: string;
  ctaLabel: string;
  href: string;
};

export type PublicService = {
  id: string;
  label: string;
  description: string;
  href: string;
  tone: string;
};

export type PartnerTrack = {
  title: string;
  description: string;
  href: string;
  metrics: string;
};

export const heroImageUrl = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1800&q=80";

export const publicServices: PublicService[] = [
  { id: "food", label: "Food", description: "Hot meals from trusted kitchens nearby.", href: "/stores?type=FOOD", tone: "bg-food-soft text-food" },
  { id: "grocery", label: "Grocery", description: "Fresh produce, staples, and daily essentials.", href: "/stores?type=GROCERY", tone: "bg-grocery-soft text-grocery" },
  { id: "pharmacy", label: "Pharmacy", description: "Medicines with prescription-ready checkout.", href: "/stores?type=PHARMACY", tone: "bg-pharmacy-soft text-pharmacy" },
  { id: "rides", label: "Rides", description: "Bike, auto, and cab pricing before you book.", href: "/rides", tone: "bg-ride-soft text-ride" },
  { id: "courier", label: "Courier", description: "Parcel pickup, live tracking, and OTP handoff.", href: "/customer/couriers", tone: "bg-courier-soft text-courier" },
  { id: "home", label: "Home services", description: "Verified professionals for scheduled jobs.", href: "/customer/home-services", tone: "bg-home-services-soft text-home-services" },
];

export const publicStores: PublicStore[] = [
  {
    id: "6a3a59a44ede828279fd9b49",
    type: "FOOD",
    name: "Paradise Biryani Vizag",
    area: "MVP Colony",
    city: "Visakhapatnam",
    description: "Hyderabadi biryani, kebabs, family combos, and late lunch staples.",
    imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=80",
    rating: 4.8,
    ratingCount: 2820,
    etaMinutes: 25,
    minOrder: 199,
    distanceKm: 2.4,
    tags: ["Biryani", "Kebabs", "Family meals"],
    isOpen: true,
    menu: [
      { section: "Best sellers", name: "Chicken Dum Biryani", description: "Aromatic rice, tender chicken, raita, and salan.", price: 249, badge: "Popular", dietaryType: "NON_VEG" },
      { section: "Best sellers", name: "Paneer Tikka Biryani", description: "Smoky paneer layered with long-grain rice.", price: 229, dietaryType: "VEG" },
      { section: "Sides", name: "Chicken 65", description: "Crisp, spicy bites tossed with curry leaves.", price: 189, dietaryType: "NON_VEG" },
    ],
  },
  {
    id: "6a40cb3cd49a0ba302b898ad",
    type: "GROCERY",
    name: "Green Field Organic Grocery",
    area: "Indiranagar",
    city: "Bengaluru",
    description: "Organic greens, fresh dairy, breakfast staples, and weekly pantry packs.",
    imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
    rating: 4.8,
    ratingCount: 1140,
    etaMinutes: 20,
    minOrder: 149,
    distanceKm: 1.8,
    tags: ["Organic", "Dairy", "Fresh produce"],
    isOpen: true,
    menu: [
      { section: "Fresh picks", name: "Organic Vegetable Basket", description: "Curated seasonal vegetables for two days.", price: 299, badge: "Fresh" },
      { section: "Dairy", name: "A2 Milk 1L", description: "Morning batch dairy from local partners.", price: 98 },
      { section: "Staples", name: "Brown Rice 1kg", description: "Stone-cleaned pantry essential.", price: 142 },
    ],
  },
  {
    id: "6a40cb3bca115798d41a280d",
    type: "PHARMACY",
    name: "Apollo Pharmacy Vizag",
    area: "Siripuram",
    city: "Visakhapatnam",
    description: "Prescription medicines, wellness products, and pharmacist verification.",
    imageUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80",
    rating: 4.7,
    ratingCount: 950,
    etaMinutes: 12,
    minOrder: 99,
    distanceKm: 1.2,
    tags: ["Medicines", "Wellness", "Prescription"],
    isOpen: true,
    menu: [
      { section: "Wellness", name: "Vitamin C Tablets", description: "Daily immunity support pack of 30.", price: 180 },
      { section: "Care", name: "Digital Thermometer", description: "Fast read thermometer with case.", price: 220 },
      { section: "Prescription", name: "Upload prescription", description: "Pharmacist review before dispatch.", price: 0, badge: "Verified" },
    ],
  },
  {
    id: "6a40cb3cd49a0ba302b898ac",
    type: "FOOD",
    name: "Burger Bistro",
    area: "Koramangala",
    city: "Bengaluru",
    description: "Smash burgers, fries, shakes, and quick solo meals.",
    imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80",
    rating: 4.6,
    ratingCount: 1765,
    etaMinutes: 25,
    minOrder: 149,
    distanceKm: 3.1,
    tags: ["Burgers", "Fries", "Shakes"],
    isOpen: true,
    menu: [
      { section: "Burgers", name: "Classic Cheese Burger", description: "Grilled patty, cheddar, house sauce, toasted bun.", price: 189, dietaryType: "NON_VEG" },
      { section: "Combos", name: "Burger Meal", description: "Burger, fries, and a chilled drink.", price: 279, badge: "Combo", dietaryType: "NON_VEG" },
      { section: "Sides", name: "Loaded Fries", description: "Crisp fries with cheese and peppers.", price: 149, dietaryType: "VEG" },
    ],
  },
  {
    id: "6a40cb3cd49a0ba302b898af",
    type: "FOOD",
    name: "Pizza Hut Vizag",
    area: "Dwaraka Nagar",
    city: "Visakhapatnam",
    description: "Pan pizzas, sides, and group meals for movie nights.",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
    rating: 4.6,
    ratingCount: 2240,
    etaMinutes: 20,
    minOrder: 249,
    distanceKm: 2.8,
    tags: ["Pizza", "Pasta", "Desserts"],
    isOpen: true,
    menu: [
      { section: "Pizzas", name: "Farmhouse Pan Pizza", description: "Capsicum, onion, tomato, corn, and mozzarella.", price: 319, dietaryType: "VEG" },
      { section: "Pizzas", name: "Chicken Pepperoni Pizza", description: "Pepperoni, cheese, and herbed crust.", price: 379, dietaryType: "NON_VEG" },
      { section: "Sides", name: "Garlic Breadsticks", description: "Baked breadsticks with cheesy dip.", price: 139, dietaryType: "VEG" },
    ],
  },
  {
    id: "6a3a59a44ede828279fd9b4a",
    type: "GROCERY",
    name: "Daily Basket Mart",
    area: "Whitefield",
    city: "Bengaluru",
    description: "Fast household essentials, snacks, cleaning supplies, and beverages.",
    imageUrl: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=900&q=80",
    rating: 4.5,
    ratingCount: 810,
    etaMinutes: 18,
    minOrder: 129,
    distanceKm: 2.2,
    tags: ["Essentials", "Snacks", "Beverages"],
    isOpen: true,
    menu: [
      { section: "Essentials", name: "Breakfast Kit", description: "Bread, eggs, butter, bananas, and milk.", price: 329, badge: "Bundle" },
      { section: "Cleaning", name: "Home Care Pack", description: "Floor cleaner, dish wash, and sanitizer.", price: 399 },
      { section: "Snacks", name: "Movie Snack Box", description: "Chips, popcorn, cola, and chocolates.", price: 249 },
    ],
  },
];

export const publicOffers: PublicOffer[] = [
  {
    id: "food-first-order",
    title: "First-order launch perk",
    description: "Preview savings for early customers ordering meals from nearby kitchens.",
    service: "Food",
    plannedBenefit: "Planned benefit: up to Rs 150",
    ctaLabel: "Explore stores",
    href: "/stores?type=FOOD",
  },
  {
    id: "ride-morning",
    title: "Morning ride perk",
    description: "A future commuter offer for bike, auto, and cab trips during busy morning hours.",
    service: "Rides",
    plannedBenefit: "Planned benefit: up to Rs 75",
    ctaLabel: "Plan a ride",
    href: "/rides",
  },
  {
    id: "grocery-pantry",
    title: "Pantry top-up perk",
    description: "A preview basket benefit for fresh produce, staples, snacks, and daily essentials.",
    service: "Grocery",
    plannedBenefit: "Planned benefit: Rs 100 basket value",
    ctaLabel: "Browse grocery",
    href: "/stores?type=GROCERY",
  },
  {
    id: "pharmacy-priority",
    title: "Priority pharmacy perk",
    description: "A planned dispatch benefit for verified prescriptions and wellness orders.",
    service: "Pharmacy",
    plannedBenefit: "Planned benefit: reduced delivery fee",
    ctaLabel: "View pharmacy",
    href: "/stores?type=PHARMACY",
  },
  {
    id: "home-service-starter",
    title: "Home service starter perk",
    description: "A future credit preview for plumbing, electrical, and repair bookings.",
    service: "Home services",
    plannedBenefit: "Planned benefit: starter service credit",
    ctaLabel: "View services",
    href: "/customer/home-services",
  },
];

export const partnerTracks: PartnerTrack[] = [
  { title: "Merchant partner", description: "Run a food, grocery, or pharmacy storefront with approvals, menus, stock, and payouts.", href: "/login", metrics: "Stores, menus, orders" },
  { title: "Fleet partner", description: "Accept delivery, courier, or ride jobs with live location, OTP handoffs, and earnings.", href: "/login", metrics: "Jobs, shifts, payouts" },
  { title: "Service professional", description: "Offer scheduled home-service visits with verified profiles and customer ratings.", href: "/login", metrics: "Slots, bookings, ratings" },
];

export const rideOptions = [
  { type: "Bike", eta: "3 min", price: "Rs 48", note: "Fastest solo rides" },
  { type: "Auto", eta: "5 min", price: "Rs 92", note: "Everyday city hops" },
  { type: "Cab", eta: "7 min", price: "Rs 168", note: "Comfort for groups" },
];

export function storesByType(type?: PublicStoreType) {
  return type ? publicStores.filter((store) => store.type === type) : publicStores;
}

export function findPublicStore(storeId: string) {
  return publicStores.find((store) => store.id === storeId);
}

export function isPublicStoreType(value: unknown): value is PublicStoreType {
  return value === "FOOD" || value === "GROCERY" || value === "PHARMACY";
}

