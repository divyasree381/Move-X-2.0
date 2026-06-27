import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { ApiEnvelope } from "@movex/shared";
import type { Response } from "express";
import type { Observable } from "rxjs";
import { map } from "rxjs";

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiEnvelope> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => ({
        success: true,
        data,
        statusCode: response.statusCode,
      })),
    );
  }
}