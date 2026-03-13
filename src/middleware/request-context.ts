/**
 * @file apps/api/src/middleware/request-context.ts
 * @author Guy Romelle Magayano
 * @description Middleware attaching request ID, correlation ID, and request-scoped logger.
 */

import { Elysia } from "elysia";

import { CORRELATION_ID_HEADER } from "@portfolio/api-contracts/http";
import { generateRequestId, type ILogger } from "@portfolio/logger";

export type ApiRequestContext = {
  requestId: string;
  correlationId: string;
  startedAt: number;
  method: string;
  path: string;
};

/** Normalizes the incoming correlation header into a single usable correlation ID. */
function resolveCorrelationId(correlationHeader: string | null): string | null {
  if (!correlationHeader) {
    return null;
  }

  const correlationId = correlationHeader.trim();
  return correlationId.length > 0 ? correlationId : null;
}

/** Resolves a normalized request pathname including query string when present. */
function resolveRequestPath(request: Request): string {
  const { pathname, search } = new URL(request.url);
  return `${pathname}${search}`;
}

/** Creates Elysia middleware that enriches every request with correlation context. */
export function createRequestContextPlugin(baseLogger: ILogger) {
  return new Elysia({
    name: "api-request-context",
  })
    .derive(({ request, set }) => {
      const requestId = generateRequestId();
      const incomingCorrelationId = resolveCorrelationId(
        request.headers.get(CORRELATION_ID_HEADER)
      );
      const correlationId = incomingCorrelationId ?? requestId;
      const requestPath = resolveRequestPath(request);

      set.headers[CORRELATION_ID_HEADER] = correlationId;

      const requestLogger = baseLogger.child({
        requestId,
        metadata: {
          correlationId,
          method: request.method,
          path: requestPath,
        },
      });

      return {
        requestContext: {
          requestId,
          correlationId,
          startedAt: performance.now(),
          method: request.method,
          path: requestPath,
        } as ApiRequestContext,
        logger: requestLogger,
      };
    })
    .as("global");
}
