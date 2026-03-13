/**
 * @file apps/api/src/server.ts
 * @author Guy Romelle Magayano
 * @description Elysia server composition for the API gateway.
 */

import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

import {
  API_ROOT_ROUTE,
  CORRELATION_ID_HEADER,
  HEALTH_ROUTE_STATUS,
  OPENAPI_ROUTE,
} from "@portfolio/api-contracts/http";

import { type ApiRuntimeConfig, getApiConfig } from "./config/env.js";
import { createApiLogger } from "./config/logger.js";
import { createProviderRegistry } from "./gateway/provider-registry.js";
import { createErrorHandlerPlugin } from "./middleware/error-handler.js";
import { createHttpLoggerPlugin } from "./middleware/http-logger.js";
import { createNotFoundHandler } from "./middleware/not-found.js";
import { createRequestContextPlugin } from "./middleware/request-context.js";
import { createContentRouter } from "./modules/content/content.routes.js";
import { createContentService } from "./modules/content/content.service.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { createMessageRouter } from "./modules/message/message.routes.js";

type CorsOriginConfig = string[] | true | false;
type AnyElysiaInstance = Elysia<any, any, any, any, any, any, any>;

/** Detects whether the gateway is running in a Bun runtime. */
function isBunRuntime(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
}

/** Resolves the CORS `origin` configuration based on environment and allowlist settings. */
export function resolveCorsOrigin(config: ApiRuntimeConfig): CorsOriginConfig {
  if (config.corsOrigins.length > 0) {
    return config.corsOrigins;
  }

  if (config.nodeEnv === "production") {
    return false;
  }

  return true;
}

/** Creates the composed Elysia server instance for the API gateway runtime. */
export const createServer = (): AnyElysiaInstance => {
  const config = getApiConfig();
  const logger = createApiLogger(config.nodeEnv);
  const providers = createProviderRegistry(config, logger);
  const contentService = createContentService(providers.content);
  const corsOrigin = resolveCorsOrigin(config);
  const shouldUseNodeAdapter = !isBunRuntime();

  const app = new Elysia({
    name: "api-gateway",
    ...(shouldUseNodeAdapter
      ? {
          adapter: node(),
        }
      : {}),
  })
    .use(
      openapi({
        path: OPENAPI_ROUTE,
        documentation: {
          info: {
            title: "Portfolio API Gateway",
            version: "1.0.0",
            description:
              "Gateway API for web/admin clients with standardized response envelopes.",
          },
          tags: [
            {
              name: "Health",
              description: "Service liveness and readiness endpoints.",
            },
            {
              name: "Message",
              description: "Demo greeting endpoints.",
            },
            {
              name: "Content",
              description:
                "Content retrieval endpoints backed by configured providers.",
            },
          ],
        },
      })
    )
    .use(
      cors({
        origin: corsOrigin,
        credentials: corsOrigin !== false,
        methods: ["GET", "HEAD", "OPTIONS"],
        allowedHeaders: [
          "accept",
          "content-type",
          "authorization",
          CORRELATION_ID_HEADER,
        ],
        exposeHeaders: [CORRELATION_ID_HEADER],
      })
    )
    .use(createRequestContextPlugin(logger))
    .use(createHttpLoggerPlugin(logger))
    .use(createErrorHandlerPlugin(logger))
    .get(API_ROOT_ROUTE, () => {
      return new Response(null, {
        status: 308,
        headers: {
          location: HEALTH_ROUTE_STATUS,
        },
      });
    })
    .use(createHealthRouter())
    .use(createMessageRouter())
    .use(createContentRouter(contentService))
    .use(createNotFoundHandler());

  if (corsOrigin === false && config.nodeEnv === "production") {
    logger.warn(
      "CORS allowlist is empty in production. Cross-origin browser requests are disabled."
    );
  }

  return app;
};
