/**
 * @file apps/api/src/contracts/http.ts
 * @author Guy Romelle Magayano
 * @description Standard API gateway response envelopes.
 */

import {
  type ApiErrorCode,
  type ApiErrorEnvelope,
  type ApiResponseMeta,
  type ApiSuccessEnvelope,
  CORRELATION_ID_HEADER,
} from "@portfolio/api-contracts/http";

export type { ApiErrorEnvelope, ApiResponseMeta, ApiSuccessEnvelope };

export type GatewayRequestContext = {
  requestId: string;
  correlationId: string;
};

export type GatewayResponseContext = {
  set: {
    status?: number | string;
    headers: Record<string, string | number>;
  };
  requestContext?: GatewayRequestContext;
};

type SuccessResponseOptions = {
  statusCode?: number;
  meta?: Record<string, unknown>;
};

type ErrorResponseOptions = {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
  meta?: Record<string, unknown>;
};

/** Builds the standard response metadata envelope for API responses. */
function createResponseMeta(
  context: GatewayResponseContext,
  extraMeta?: Record<string, unknown>
): ApiResponseMeta {
  const correlationHeader = context.set.headers[CORRELATION_ID_HEADER];
  const correlationIdFromHeaders =
    typeof correlationHeader === "string" ||
    typeof correlationHeader === "number"
      ? String(correlationHeader).trim()
      : "";
  const correlationId =
    context.requestContext?.correlationId ??
    (correlationIdFromHeaders || "unknown");
  // Keep `requestId` distinct from `correlationId` even when request context is unavailable.
  const requestId = context.requestContext?.requestId ?? "unknown";

  return {
    correlationId,
    requestId,
    timestamp: new Date().toISOString(),
    ...extraMeta,
  };
}

/** Sends a success response envelope. */
export function sendSuccess<T>(
  context: GatewayResponseContext,
  data: T,
  options: SuccessResponseOptions = {}
): ApiSuccessEnvelope<T> {
  const { statusCode = 200, meta } = options;

  context.set.status = statusCode;

  return {
    success: true,
    data,
    meta: createResponseMeta(context, meta),
  };
}

/** Sends an error response envelope. */
export function sendError(
  context: GatewayResponseContext,
  options: ErrorResponseOptions
): ApiErrorEnvelope {
  context.set.status = options.statusCode;

  return {
    success: false,
    error: {
      code: options.code,
      message: options.message,
      details: options.details,
    },
    meta: createResponseMeta(context, options.meta),
  };
}
