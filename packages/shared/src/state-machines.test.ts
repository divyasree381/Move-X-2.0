import { describe, expect, it } from "vitest";

import {
  CourierStatus,
  HomeServiceStatus,
  OrderStatus,
  RideStatus,
  canTransition,
  courierStatusTransitions,
  homeServiceStatusTransitions,
  orderStatusTransitions,
  rideStatusTransitions,
} from "./state-machines";

describe("shared state machines", () => {
  it("allows legal order transitions and rejects jumps", () => {
    expect(canTransition(orderStatusTransitions, OrderStatus.PLACED, OrderStatus.ACCEPTED)).toBe(true);
    expect(canTransition(orderStatusTransitions, OrderStatus.READY, OrderStatus.PICKED_UP)).toBe(true);
    expect(canTransition(orderStatusTransitions, OrderStatus.PLACED, OrderStatus.DELIVERED)).toBe(false);
    expect(canTransition(orderStatusTransitions, OrderStatus.CANCELLED, OrderStatus.ACCEPTED)).toBe(false);
  });

  it("allows legal ride/courier/home-service transitions and rejects jumps", () => {
    expect(canTransition(rideStatusTransitions, RideStatus.REQUESTED, RideStatus.ASSIGNED)).toBe(true);
    expect(canTransition(rideStatusTransitions, RideStatus.ASSIGNED, RideStatus.COMPLETED)).toBe(false);
    expect(canTransition(courierStatusTransitions, CourierStatus.ARRIVED, CourierStatus.IN_TRANSIT)).toBe(true);
    expect(canTransition(courierStatusTransitions, CourierStatus.REQUESTED, CourierStatus.COMPLETED)).toBe(false);
    expect(canTransition(homeServiceStatusTransitions, HomeServiceStatus.ARRIVED, HomeServiceStatus.IN_SERVICE)).toBe(true);
    expect(canTransition(homeServiceStatusTransitions, HomeServiceStatus.REQUESTED, HomeServiceStatus.COMPLETED)).toBe(false);
  });
});
