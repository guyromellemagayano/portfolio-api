/**
 * @file apps/api/src/utils/request-logger.ts
 * @author Guy Romelle Magayano
 * @description Shared helpers for accessing request-scoped loggers from Elysia contexts.
 */

import type { ILogger } from "@portfolio/logger";

type LoggerContext = {
  logger?: ILogger;
};

/** Resolves a request-scoped logger from a generic Elysia context shape. */
export function getLoggerFromContext(context: unknown): ILogger | null {
  if (!context || typeof context !== "object" || !("logger" in context)) {
    return null;
  }

  return (context as LoggerContext).logger ?? null;
}
