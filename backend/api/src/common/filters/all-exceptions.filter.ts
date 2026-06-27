import {
  BadRequestException,
  Catch,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { ErrorCode } from "@movex/shared";
import type { ArgumentsHost } from "@nestjs/common";
import type { Response } from "express";
import { captureException } from "../../observability";

type ErrorCodeValue = `${ErrorCode}`;

type ErrorEnvelope = {
  success: false;
  statusCode: number;
  errorCode: ErrorCodeValue;
  message: string;
};

const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const satisfies Record<string, ErrorCodeValue>;

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== "http") {
      super.catch(exception, host);
      return;
    }

    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = this.getStatusCode(exception);
    if (statusCode >= 500) {
      captureException(exception);
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      errorCode: this.getErrorCode(exception, statusCode),
      message: this.getMessage(exception),
    } satisfies ErrorEnvelope);
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorCode(exception: unknown, statusCode: number): ErrorCodeValue {
    if (exception instanceof BadRequestException) {
      return ERROR_CODES.VALIDATION_ERROR;
    }

    if (exception instanceof UnauthorizedException || statusCode === HttpStatus.UNAUTHORIZED) {
      return ERROR_CODES.UNAUTHENTICATED;
    }

    if (exception instanceof ForbiddenException || statusCode === HttpStatus.FORBIDDEN) {
      return ERROR_CODES.FORBIDDEN;
    }

    if (exception instanceof NotFoundException || statusCode === HttpStatus.NOT_FOUND) {
      return ERROR_CODES.NOT_FOUND;
    }

    if (exception instanceof ConflictException || statusCode === HttpStatus.CONFLICT) {
      return ERROR_CODES.CONFLICT;
    }

    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return ERROR_CODES.RATE_LIMITED;
    }

    return ERROR_CODES.INTERNAL_SERVER_ERROR;
  }

  private getMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === "string") {
        return response;
      }

      if (this.isHttpExceptionBody(response)) {
        const message = response.message;

        if (Array.isArray(message)) {
          return message.join("; ");
        }

        if (typeof message === "string") {
          return message;
        }
      }

      return exception.message;
    }

    if (exception instanceof Error) {
      return exception.message || "Internal server error";
    }

    return "Internal server error";
  }

  private isHttpExceptionBody(value: unknown): value is { message?: unknown } {
    return typeof value === "object" && value !== null && "message" in value;
  }
}


