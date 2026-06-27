export type RouteOptimizationInput = {
  partner: { userId: string; role: string };
  maxStops: number;
  objective: "DISTANCE" | "ETA" | "PAYOUT";
};

export type RouteOptimizationPlan = {
  mode: "STUB";
  objective: "DISTANCE" | "ETA" | "PAYOUT";
  maxStops: number;
  stops: Array<{ id: string; type: "ORDER" | "RIDE" | "COURIER" | "HOME_SERVICE"; lat?: number; lng?: number }>;
  notes: string[];
};

export interface RouteOptimizationProvider {
  planBatch(input: RouteOptimizationInput): Promise<RouteOptimizationPlan>;
}

export class StubRouteOptimizationProvider implements RouteOptimizationProvider {
  async planBatch(input: RouteOptimizationInput): Promise<RouteOptimizationPlan> {
    return {
      mode: "STUB",
      objective: input.objective,
      maxStops: input.maxStops,
      stops: [],
      notes: ["Batching and route optimization adapter is wired; real solver/provider can replace this stub."],
    };
  }
}