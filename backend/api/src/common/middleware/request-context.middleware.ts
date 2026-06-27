import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import type { RequestWithContext } from "../types/request-context";

const REQUEST_ID_HEADER = "x-request-id";
const CORRELATION_ID_HEADER = "x-correlation-id";

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestWithContext = request as RequestWithContext;
  const requestId = getFirstHeaderValue(request.headers[REQUEST_ID_HEADER]) ?? randomUUID();
  const correlationId = getFirstHeaderValue(request.headers[CORRELATION_ID_HEADER]) ?? requestId;

  requestWithContext.id = requestId;
  requestWithContext.requestId = requestId;
  requestWithContext.correlationId = correlationId;

  response.setHeader(REQUEST_ID_HEADER, requestId);
  response.setHeader(CORRELATION_ID_HEADER, correlationId);

  next();
}

function getFirstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}