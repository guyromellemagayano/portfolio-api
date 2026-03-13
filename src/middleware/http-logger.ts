/**
 * @file apps/api/src/middleware/http-logger.ts
 * @author Guy Romelle Magayano
 * @description HTTP access logging middleware powered by the shared logger.
 */

import { Elysia } from "elysia";

import {
  HEALTH_ROUTE_LEGACY,
  HEALTH_ROUTE_STATUS,
} from "@portfolio/api-contracts/http";
import type { ILogger } from "@portfolio/logger";

import { API_ENV_KEYS } from "../config/env-keys.js";
import type { ApiRequestContext } from "./request-context.js";

type HttpLoggerContext = {
  request: Request;
  set: {
    status?: number | string;
    headers: Record<string, string>;
  };
  logger?: ILogger;
  requestContext?: ApiRequestContext;
};

/** Formats the HTTP access log message emitted by the shared logger transport. */
function formatHttpAccessLogMessage(
  requestId: string,
  correlationId: string,
  method: string,
  path: string,
  statusCode: number,
  contentLength: string,
  responseTimeMs: number,
  userAgent?: string
): string {
  const baseMessage = `${requestId} ${correlationId} ${method} ${path} ${statusCode} ${contentLength} - ${responseTimeMs.toFixed(2)} ms`;

  if (!userAgent) {
    return baseMessage;
  }

  return `${baseMessage} "${userAgent}"`;
}

/** Creates an HTTP access log plugin wired to the shared logger. */
export function createHttpLoggerPlugin(logger: ILogger) {
  const isProduction = process.env[API_ENV_KEYS.NODE_ENV] === "production";

  return new Elysia({
    name: "api-http-logger",
  })
    .onAfterResponse((context) => {
      const typedContext = context as HttpLoggerContext;
      const requestContext = typedContext.requestContext;

      if (!requestContext) {
        return;
      }

      const requestPathname = new URL(typedContext.request.url).pathname;
      const shouldSkip =
        isProduction &&
        (requestPathname === HEALTH_ROUTE_LEGACY ||
          requestPathname === HEALTH_ROUTE_STATUS);

      if (shouldSkip) {
        return;
      }

      const requestLogger = typedContext.logger ?? logger;
      const elapsedMs = Math.max(
        0,
        performance.now() - requestContext.startedAt
      );
      const statusCode =
        typeof typedContext.set.status === "number"
          ? typedContext.set.status
          : 200;
      const contentLength = typedContext.set.headers["content-length"];
      const contentLengthText =
        typeof contentLength === "string" && contentLength.trim()
          ? contentLength
          : "-";
      const userAgent = typedContext.request.headers.get("user-agent");

      requestLogger.http(
        formatHttpAccessLogMessage(
          requestContext.requestId,
          requestContext.correlationId,
          requestContext.method,
          requestContext.path,
          statusCode,
          contentLengthText,
          elapsedMs,
          isProduction ? undefined : (userAgent ?? "-")
        ),
        {
          statusCode,
          method: requestContext.method,
          path: requestContext.path,
          contentLength: contentLengthText,
          responseTimeMs: elapsedMs,
          userAgent: userAgent ?? null,
        }
      );
    })
    .as("global");
}
