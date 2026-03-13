/**
 * @file apps/api/src/contracts/errors.ts
 * @author Guy Romelle Magayano
 * @description Normalized API gateway error types and helpers.
 */

import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  type ApiErrorCode,
} from "@portfolio/api-contracts/http";

export type GatewayErrorOptions = {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export class GatewayError extends Error {
  statusCode: number;
  code: ApiErrorCode;
  details?: unknown;

  constructor(options: GatewayErrorOptions) {
    super(options.message);
    this.name = "GatewayError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
  }
}

/** Converts unknown errors into a normalized `GatewayError`. */
export function toGatewayError(error: unknown): GatewayError {
  if (error instanceof GatewayError) {
    return error;
  }

  if (error instanceof Error) {
    return new GatewayError({
      statusCode: 500,
      code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: API_ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      details: {
        name: error.name,
        message: error.message,
      },
    });
  }

  return new GatewayError({
    statusCode: 500,
    code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: API_ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  });
}
