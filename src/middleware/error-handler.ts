/**
 * @file apps/api/src/middleware/error-handler.ts
 * @author Guy Romelle Magayano
 * @description Centralized error middleware for normalized API gateway responses.
 */

import { Elysia } from "elysia";

import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
} from "@portfolio/api-contracts/http";
import type { ILogger } from "@portfolio/logger";

import { toGatewayError } from "../contracts/errors.js";
import { sendError } from "../contracts/http.js";
import type { ApiRequestContext } from "./request-context.js";

type ErrorHandlerContext = {
  error: unknown;
  request: Request;
  logger?: ILogger;
  requestContext?: ApiRequestContext;
  set: {
    status?: number | string;
    headers: Record<string, string>;
  };
};

/** Creates an error handler plugin that normalizes and logs all request failures. */
export function createErrorHandlerPlugin(baseLogger: ILogger) {
  return new Elysia({
    name: "api-error-handler",
  })
    .onError((context) => {
      const typedContext = context as ErrorHandlerContext;
      const gatewayError = toGatewayError(typedContext.error);
      const requestLogger = typedContext.logger ?? baseLogger;
      const requestPathname = new URL(typedContext.request.url).pathname;
      const requestMethod = typedContext.request.method;

      requestLogger.error("Unhandled API gateway error", gatewayError, {
        component: "error-handler",
        metadata: {
          code: gatewayError.code,
          statusCode: gatewayError.statusCode,
          path: requestPathname,
          method: requestMethod,
        },
      });

      const { requestContext } = typedContext;

      if (!requestContext) {
        return {
          success: false,
          error: {
            code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: API_ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
          },
          meta: {
            correlationId: "unknown",
            requestId: "unknown",
            timestamp: new Date().toISOString(),
          },
        };
      }

      return sendError(
        {
          ...typedContext,
          requestContext,
        },
        {
          statusCode: gatewayError.statusCode,
          code: gatewayError.code,
          message: gatewayError.message,
          details: gatewayError.details,
        }
      );
    })
    .as("global");
}
