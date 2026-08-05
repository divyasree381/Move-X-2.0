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

export type PublicService = {
  id: string;
  label: string;
  description: string;
  href: string;
  tone: string;
  imageUrl: string;
};

export type PartnerTrack = {
  title: string;
  description: string;
  href: string;
  metrics: string;
};

export type PublicHeroSlide = {
  id: "food" | "grocery" | "pharmacy" | "rides" | "courier" | "home";
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  promise: string;
  ctaLabel: string;
  href: string;
  imageUrl: string;
  imageAlt: string;
};

export const publicHeroSlides: PublicHeroSlide[] = [
  {
    id: "food",
    label: "Food",
    eyebrow: "Meals around you",
    title: "Your city is cooking. Pick what arrives next.",
    description: "Discover trusted kitchens, clear delivery times, and dishes for every kind of day.",
    promise: "Menus and delivery estimates",
    ctaLabel: "Order food",
    href: "/stores?type=FOOD",
    imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1800&q=82",
    imageAlt: "A table filled with freshly prepared meals",
  },
  {
    id: "grocery",
    label: "Grocery",
    eyebrow: "Everyday essentials",
    title: "Fresh produce and pantry staples, without the store run.",
    description: "Build the weekly basket or replace the one thing you ran out of, all from nearby stores.",
    promise: "Fresh stock from local grocery partners",
    ctaLabel: "Shop groceries",
    href: "/stores?type=GROCERY",
    imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=82",
    imageAlt: "Fresh fruit and vegetables arranged at a grocery market",
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    eyebrow: "Health and wellness",
    title: "Medicines and care products with verification built in.",
    description: "Find nearby pharmacies, upload prescriptions securely, and track pharmacist review before dispatch.",
    promise: "Prescription-ready checkout",
    ctaLabel: "Find medicines",
    href: "/stores?type=PHARMACY",
    imageUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1800&q=82",
    imageAlt: "Organized medicine and wellness products in a pharmacy",
  },
  {
    id: "rides",
    label: "Rides",
    eyebrow: "Move across the city",
    title: "Bike, auto, or cab. See the route before you book.",
    description: "Pin pickup and destination, compare route-based estimates, and choose the ride that fits the moment.",
    promise: "Route-based fares and nearby drivers",
    ctaLabel: "Book a ride",
    href: "/customer/rides",
    imageUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1800&q=82",
    imageAlt: "A passenger travelling through the city by car",
  },
  {
    id: "courier",
    label: "Courier",
    eyebrow: "Send parcels nearby",
    title: "Door-to-door delivery with both handoffs protected.",
    description: "Choose pickup and delivery on one map, see the fare, and follow the parcel through OTP handoffs.",
    promise: "Route estimates, tracking, and secure handoff",
    ctaLabel: "Send a parcel",
    href: "/customer/couriers",
    imageUrl: "https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=1800&q=82",
    imageAlt: "A local courier carrying parcels for delivery",
  },
  {
    id: "home",
    label: "Home services",
    eyebrow: "Trusted help at home",
    title: "Book verified professionals for the jobs that cannot wait.",
    description: "Compare services, choose a time slot, and follow the visit from confirmation to completion.",
    promise: "Scheduled visits from verified professionals",
    ctaLabel: "Explore services",
    href: "/customer/home-services",
    imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1800&q=82",
    imageAlt: "A home service professional cleaning a modern living space",
  },
];

export const publicServices: PublicService[] = [
  { id: "food", label: "Food", description: "Hot meals from trusted kitchens nearby.", href: "/stores?type=FOOD", tone: "bg-food-soft text-food", imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80",
  },
  { id: "grocery", label: "Grocery", description: "Fresh produce, staples, and daily essentials.", href: "/stores?type=GROCERY", tone: "bg-grocery-soft text-grocery", imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
  },
  { id: "pharmacy", label: "Pharmacy", description: "Medicines with prescription-ready checkout.", href: "/stores?type=PHARMACY", tone: "bg-pharmacy-soft text-pharmacy", imageUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80",
  },
  { id: "rides", label: "Rides", description: "Bike, auto, and cab pricing before you book.", href: "/customer/rides", tone: "bg-ride-soft text-ride", imageUrl: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=900&q=80",
  },
  { id: "courier", label: "Courier", description: "Parcel pickup, route tracking, and OTP handoff.", href: "/customer/couriers", tone: "bg-courier-soft text-courier", imageUrl: "https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=900&q=80",
  },
  { id: "home", label: "Home services", description: "Verified professionals for scheduled jobs.", href: "/customer/home-services", tone: "bg-home-services-soft text-home-services", imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80",
  },
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
      { section: "Best sellers", name: "Chicken Dum Biryani", description: "Aromatic rice, tender chicken, raita, and salan.", price: 249, badge: "Popular", dietaryType: "NON_VEG",
      },
      { section: "Best sellers", name: "Paneer Tikka Biryani", description: "Smoky paneer layered with long-grain rice.", price: 229, dietaryType: "VEG",
      },
      { section: "Sides", name: "Chicken 65", description: "Crisp, spicy bites tossed with curry leaves.", price: 189, dietaryType: "NON_VEG",
      },
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
      { section: "Fresh picks", name: "Organic Vegetable Basket", description: "Curated seasonal vegetables for two days.", price: 299, badge: "Fresh",
      },
      { section: "Dairy", name: "A2 Milk 1L", description: "Morning batch dairy from local partners.", price: 98,
      },
      { section: "Staples", name: "Brown Rice 1kg", description: "Stone-cleaned pantry essential.", price: 142,
      },
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
      { section: "Wellness", name: "Vitamin C Tablets", description: "Daily immunity support pack of 30.", price: 180,
      },
      { section: "Care", name: "Digital Thermometer", description: "Fast read thermometer with case.", price: 220,
      },
      { section: "Prescription", name: "Upload prescription", description: "Pharmacist review before dispatch.", price: 0, badge: "Verified",
      },
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
      { section: "Burgers", name: "Classic Cheese Burger", description: "Grilled patty, cheddar, house sauce, toasted bun.", price: 189, dietaryType: "NON_VEG",
      },
      { section: "Combos", name: "Burger Meal", description: "Burger, fries, and a chilled drink.", price: 279, badge: "Combo", dietaryType: "NON_VEG",
      },
      { section: "Sides", name: "Loaded Fries", description: "Crisp fries with cheese and peppers.", price: 149, dietaryType: "VEG",
      },
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
      { section: "Pizzas", name: "Farmhouse Pan Pizza", description: "Capsicum, onion, tomato, corn, and mozzarella.", price: 319, dietaryType: "VEG",
      },
      { section: "Pizzas", name: "Chicken Pepperoni Pizza", description: "Pepperoni, cheese, and herbed crust.", price: 379, dietaryType: "NON_VEG",
      },
      { section: "Sides", name: "Garlic Breadsticks", description: "Baked breadsticks with cheesy dip.", price: 139, dietaryType: "VEG",
      },
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
      { section: "Essentials", name: "Breakfast Kit", description: "Bread, eggs, butter, bananas, and milk.", price: 329, badge: "Bundle",
      },
      { section: "Cleaning", name: "Home Care Pack", description: "Floor cleaner, dish wash, and sanitizer.", price: 399,
      },
      { section: "Snacks", name: "Movie Snack Box", description: "Chips, popcorn, cola, and chocolates.", price: 249,
      },
    ],
  },
];

export const partnerTracks: PartnerTrack[] = [
  {
    title: "Merchant partner",
    description: "Run a food, grocery, or pharmacy storefront with approvals, menus, stock, and payouts.",
    href: "/login",
    metrics: "Stores, menus, orders",
  },
  {
    title: "Fleet partner",
    description: "Accept delivery, courier, or ride jobs with live location, OTP handoffs, and earnings.",
    href: "/login",
    metrics: "Jobs, shifts, payouts",
  },
  {
    title: "Service professional", description: "Offer scheduled home-service visits with verified profiles and customer ratings.", href: "/login", metrics: "Slots, bookings, ratings",
  },
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

export function resolvePublicStoreType(value: unknown): PublicStoreType | undefined {
  return isPublicStoreType(value) ? value : undefined;
}

