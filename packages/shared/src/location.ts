import { z } from "zod";

export const locationSourceValues = ["autocomplete", "map-click", "marker-drag", "gps"] as const;

export type LocationSource = (typeof locationSourceValues)[number];

export type SelectedLocation = {
  address: string;
  placeId?: string;
  lat: number;
  lng: number;
  source: LocationSource;
};

export const locationSourceSchema = z.enum(locationSourceValues);

export const selectedLocationSchema = z.object({
  address: z.string().min(1),
  placeId: z.string().min(1).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  source: locationSourceSchema,
});