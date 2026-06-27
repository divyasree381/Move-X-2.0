import type { Observable } from "rxjs";

export const REALTIME_PROVIDER = Symbol("REALTIME_PROVIDER");

export type RealtimeMessage = {
  id: string;
  type: string;
  topic: string;
  payload: unknown;
  createdAt: string;
};

export interface RealtimeProvider {
  publish(topic: string, message: Omit<RealtimeMessage, "topic" | "createdAt"> & { createdAt?: string }): Promise<void>;
  stream(topic: string): Observable<RealtimeMessage>;
}