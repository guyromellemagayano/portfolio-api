/**
 * @file apps/api/src/modules/health/health.routes.ts
 * @author Guy Romelle Magayano
 * @description Health-check routes for gateway liveness/readiness, with legacy route redirects to the latest versioned endpoint.
 */

import { Elysia, t } from "elysia";

import {
  HEALTH_ROUTE_LEGACY,
  HEALTH_ROUTE_STATUS,
} from "@portfolio/api-contracts/http";

import { sendSuccess } from "../../contracts/http.js";
import { getLoggerFromContext } from "../../utils/request-logger.js";

type AnyElysiaInstance = Elysia<any, any, any, any, any, any, any>;

/** Creates health-check routes. */
export function createHealthRouter(): AnyElysiaInstance {
  return new Elysia({
    name: "api-health-routes",
  })
    .get(
      HEALTH_ROUTE_LEGACY,
      (context) => {
        const requestLogger = getLoggerFromContext(context);

        requestLogger?.debug(
          "Redirecting legacy health check route to versioned endpoint"
        );

        return new Response(null, {
          status: 308,
          headers: {
            location: HEALTH_ROUTE_STATUS,
          },
        });
      },
      {
        detail: {
          tags: ["Health"],
          summary: "Legacy health redirect",
          description: "Redirects legacy health checks to the versioned route.",
        },
      }
    )
    .get(
      HEALTH_ROUTE_STATUS,
      (context) => {
        const requestLogger = getLoggerFromContext(context);

        requestLogger?.debug("Versioned health check requested");

        return sendSuccess(
          context,
          { ok: true },
          {
            meta: {
              service: "api-gateway",
            },
          }
        );
      },
      {
        detail: {
          tags: ["Health"],
          summary: "Gateway health status",
          description: "Returns the API gateway liveness status.",
        },
        response: {
          200: t.Any(),
        },
      }
    );
}
