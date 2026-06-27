import { strict as assert } from "node:assert";
import { Prisma, RideStatus, VehicleType } from "@prisma/client";

import { RidesService } from "../src/modules/rides/rides.service";

async function main(): Promise<void> {
  const redis = {
    async getJson<T>(key: string): Promise<T | null> {
      if (key === "surge:ride:BIKE") {
        return { multiplier: "1.5" } as T;
      }
      return null;
    },
  };
  const service = new RidesService({} as never, redis as never, {} as never, {} as never, {} as never);
  const calculateFare = (service as unknown as { calculateFare(vehicleType: VehicleType, route: { distanceMeters: number; durationSeconds: number; polyline: string }): Promise<{ estimatedFare: string; surgeMultiplier: string; distanceKm: string; durationMinutes: number }> }).calculateFare.bind(service);
  const calculateCancellationFee = (service as unknown as { calculateCancellationFee(ride: { status: RideStatus; estimatedFare: Prisma.Decimal; driverId: string | null }, customerCancelled: boolean): Prisma.Decimal }).calculateCancellationFee.bind(service);

  const estimate = await calculateFare(VehicleType.BIKE, { distanceMeters: 5000, durationSeconds: 900, polyline: "encoded" });
  assert.equal(estimate.distanceKm, "5.00");
  assert.equal(estimate.durationMinutes, 15);
  assert.equal(estimate.surgeMultiplier, "1.50");
  assert.equal(estimate.estimatedFare, "120.00");

  assert.equal(calculateCancellationFee({ status: RideStatus.ASSIGNED, estimatedFare: new Prisma.Decimal(300), driverId: "driver_1" }, true).toString(), "50");
  assert.equal(calculateCancellationFee({ status: RideStatus.ARRIVED, estimatedFare: new Prisma.Decimal(100), driverId: "driver_1" }, true).toString(), "20");
  assert.equal(calculateCancellationFee({ status: RideStatus.REQUESTED, estimatedFare: new Prisma.Decimal(100), driverId: null }, true).toString(), "0");
  assert.equal(calculateCancellationFee({ status: RideStatus.ASSIGNED, estimatedFare: new Prisma.Decimal(100), driverId: "driver_1" }, false).toString(), "0");
}

void main();