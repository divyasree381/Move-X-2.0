import type { Request } from "express";

export type RequestWithContext = Request & {
  id?: string;
  requestId?: string;
  correlationId?: string;
};