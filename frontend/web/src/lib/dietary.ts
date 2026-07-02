export type DietaryType = "VEG" | "NON_VEG" | "EGG";

type DietarySource = {
  dietaryType?: DietaryType | null;
  name?: string;
  description?: string;
  tags?: string[];
};

export const dietaryLabels: Record<DietaryType, string> = {
  VEG: "Veg",
  NON_VEG: "Non-veg",
  EGG: "Egg",
};

export function resolveDietaryType(item: DietarySource, storeType?: string): DietaryType | null {
  if (item.dietaryType) {
    return item.dietaryType;
  }

  if (storeType && storeType !== "FOOD") {
    return null;
  }

  const signal = [item.name, item.description, ...(item.tags ?? [])].filter(Boolean).join(" ").toLowerCase();

  if (!signal) {
    return null;
  }

  if (/\b(egg|eggs|omelette)\b/.test(signal)) {
    return "EGG";
  }

  if (/\b(chicken|mutton|fish|prawn|meat|pepperoni|kebab|keema)\b/.test(signal)) {
    return "NON_VEG";
  }

  if (/\b(veg|vegetarian|paneer|farmhouse|fries|breadsticks|mushroom|corn)\b/.test(signal)) {
    return "VEG";
  }

  return null;
}

