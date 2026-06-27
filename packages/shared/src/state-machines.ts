export enum OrderStatus {
  PLACED = "PLACED",
  ACCEPTED = "ACCEPTED",
  PREPARING = "PREPARING",
  READY = "READY",
  PICKED_UP = "PICKED_UP",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export enum RideStatus {
  REQUESTED = "REQUESTED",
  ASSIGNED = "ASSIGNED",
  ARRIVED = "ARRIVED",
  IN_RIDE = "IN_RIDE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum CourierStatus {
  REQUESTED = "REQUESTED",
  ASSIGNED = "ASSIGNED",
  ARRIVED = "ARRIVED",
  IN_TRANSIT = "IN_TRANSIT",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum HomeServiceStatus {
  REQUESTED = "REQUESTED",
  ASSIGNED = "ASSIGNED",
  ARRIVED = "ARRIVED",
  IN_SERVICE = "IN_SERVICE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export type TransitionMap<TStatus extends string> = Readonly<Record<TStatus, readonly TStatus[]>>;

export const orderStatusTransitions = {
  [OrderStatus.PLACED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
  [OrderStatus.PICKED_UP]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
} as const satisfies TransitionMap<OrderStatus>;

export const rideStatusTransitions = {
  [RideStatus.REQUESTED]: [RideStatus.ASSIGNED, RideStatus.CANCELLED],
  [RideStatus.ASSIGNED]: [RideStatus.ARRIVED, RideStatus.CANCELLED],
  [RideStatus.ARRIVED]: [RideStatus.IN_RIDE, RideStatus.CANCELLED],
  [RideStatus.IN_RIDE]: [RideStatus.COMPLETED],
  [RideStatus.COMPLETED]: [],
  [RideStatus.CANCELLED]: [],
} as const satisfies TransitionMap<RideStatus>;

export const courierStatusTransitions = {
  [CourierStatus.REQUESTED]: [CourierStatus.ASSIGNED, CourierStatus.CANCELLED],
  [CourierStatus.ASSIGNED]: [CourierStatus.ARRIVED, CourierStatus.CANCELLED],
  [CourierStatus.ARRIVED]: [CourierStatus.IN_TRANSIT, CourierStatus.CANCELLED],
  [CourierStatus.IN_TRANSIT]: [CourierStatus.COMPLETED],
  [CourierStatus.COMPLETED]: [],
  [CourierStatus.CANCELLED]: [],
} as const satisfies TransitionMap<CourierStatus>;

export const homeServiceStatusTransitions = {
  [HomeServiceStatus.REQUESTED]: [HomeServiceStatus.ASSIGNED, HomeServiceStatus.CANCELLED],
  [HomeServiceStatus.ASSIGNED]: [HomeServiceStatus.ARRIVED, HomeServiceStatus.CANCELLED],
  [HomeServiceStatus.ARRIVED]: [HomeServiceStatus.IN_SERVICE, HomeServiceStatus.CANCELLED],
  [HomeServiceStatus.IN_SERVICE]: [HomeServiceStatus.COMPLETED],
  [HomeServiceStatus.COMPLETED]: [],
  [HomeServiceStatus.CANCELLED]: [],
} as const satisfies TransitionMap<HomeServiceStatus>;

export function canTransition<TStatus extends string>(
  transitions: TransitionMap<TStatus>,
  from: TStatus,
  to: TStatus,
): boolean {
  return transitions[from].includes(to);
}