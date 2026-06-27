import { z, type ZodTypeAny } from "zod";

import { ErrorCode } from "./enums.js";

export type ApiEnvelope<TData = unknown> = {
  success: boolean;
  data?: TData;
  message?: string;
  statusCode: number;
  errorCode?: ErrorCode;
};

export const errorCodeSchema = z.enum(ErrorCode);

export const apiEnvelopeSchema = <TData extends ZodTypeAny>(dataSchema: TData) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    message: z.string().optional(),
    statusCode: z.number().int().positive(),
    errorCode: errorCodeSchema.optional(),
  });