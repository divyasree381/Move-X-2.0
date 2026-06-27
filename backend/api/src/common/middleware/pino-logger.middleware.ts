import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";

import type { RequestWithContext } from "../types/request-context";

export function createPinoLoggerMiddleware() {
  return pinoHttp({
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers['x-csrf-token']",
        "req.headers['x-xsrf-token']",
        "req.headers['x-razorpay-signature']",
        "res.headers['set-cookie']",
      ],
      censor: "[Redacted]",
    },
    genReqId: (request) => (request as RequestWithContext).requestId ?? randomUUID(),
    customProps: (request) => ({
      correlationId: (request as RequestWithContext).correlationId,
    }),
  });
}