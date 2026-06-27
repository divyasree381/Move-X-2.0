import { z } from "zod";

import { selectedLocationSchema } from "./location.js";

export const mapTravelModeValues = ["DRIVE", "TWO_WHEELER", "WALK", "BICYCLE"] as const;

export type MapTravelMode = (typeof mapTravelModeValues)[number];

export type MapSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
};

export type RouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
};

export type RouteMatrixCell = RouteSummary & {
  originIndex: number;
  destinationIndex: number;
  status?: string;
};

export type RouteMatrix = RouteMatrixCell[][];

export const mapTravelModeSchema = z.enum(mapTravelModeValues);

export const mapSuggestionSchema = z.object({
  placeId: z.string().min(1),
  description: z.string().min(1),
  mainText: z.string().min(1),
  secondaryText: z.string().min(1).optional(),
});

export const routeSummarySchema = z.object({
  distanceMeters: z.number().int().nonnegative(),
  durationSeconds: z.number().int().nonnegative(),
  polyline: z.string(),
});

export const routeMatrixCellSchema = routeSummarySchema.extend({
  originIndex: z.number().int().nonnegative(),
  destinationIndex: z.number().int().nonnegative(),
  status: z.string().optional(),
});

export const routeMatrixSchema = z.array(z.array(routeMatrixCellSchema));

export const routePointSchema = selectedLocationSchema.pick({
  address: true,
  placeId: true,
  lat: true,
  lng: true,
  source: true,
});