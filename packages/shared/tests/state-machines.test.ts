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
} from "../src";

describe("canTransition", () => {
  it("allows legal order transitions", () => {
    expect(canTransition(orderStatusTransitions, OrderStatus.PLACED, OrderStatus.ACCEPTED)).toBe(
      true,
    );
    expect(canTransition(orderStatusTransitions, OrderStatus.READY, OrderStatus.PICKED_UP)).toBe(
      true,
    );
  });

  it("rejects illegal order transitions", () => {
    expect(canTransition(orderStatusTransitions, OrderStatus.PLACED, OrderStatus.DELIVERED)).toBe(
      false,
    );
    expect(
      canTransition(orderStatusTransitions, OrderStatus.DELIVERED, OrderStatus.CANCELLED),
    ).toBe(false);
  });

  it("allows and rejects ride-shaped transitions", () => {
    expect(canTransition(rideStatusTransitions, RideStatus.REQUESTED, RideStatus.ASSIGNED)).toBe(
      true,
    );
    expect(
      canTransition(courierStatusTransitions, CourierStatus.ASSIGNED, CourierStatus.ARRIVED),
    ).toBe(true);
    expect(
      canTransition(
        homeServiceStatusTransitions,
        HomeServiceStatus.ARRIVED,
        HomeServiceStatus.COMPLETED,
      ),
    ).toBe(false);
    expect(canTransition(rideStatusTransitions, RideStatus.COMPLETED, RideStatus.CANCELLED)).toBe(
      false,
    );
  });
});