/**
 * @file apps/api/src/modules/message/message.routes.ts
 * @author Guy Romelle Magayano
 * @description Message demo routes with legacy route redirects and versioned envelope responses.
 */

import { Elysia, t } from "elysia";

import {
  getMessageRoute,
  MESSAGE_ROUTE_LEGACY_PATTERN,
  MESSAGE_ROUTE_PATTERN,
} from "@portfolio/api-contracts/http";

import { sendSuccess } from "../../contracts/http.js";
import { getLoggerFromContext } from "../../utils/request-logger.js";

type AnyElysiaInstance = Elysia<any, any, any, any, any, any, any>;

/** Creates demo message routes. */
export function createMessageRouter(): AnyElysiaInstance {
  return new Elysia({
    name: "api-message-routes",
  })
    .get(
      MESSAGE_ROUTE_LEGACY_PATTERN,
      (context) => {
        const { params, request } = context;
        const name = params.name?.trim() ?? "";
        const userAgent = request.headers.get("user-agent");
        const requestLogger = getLoggerFromContext(context);

        requestLogger?.info(
          "Redirecting legacy message request to versioned route",
          {
            name,
            userAgent,
          }
        );

        return new Response(null, {
          status: 308,
          headers: {
            location: getMessageRoute(name),
          },
        });
      },
      {
        params: t.Object({
          name: t.String(),
        }),
        detail: {
          tags: ["Message"],
          summary: "Legacy message redirect",
          description:
            "Redirects legacy message requests to the versioned message route.",
        },
      }
    )
    .get(
      MESSAGE_ROUTE_PATTERN,
      (context) => {
        const name = context.params.name?.trim() ?? "";
        const userAgent = context.request.headers.get("user-agent");
        const requestLogger = getLoggerFromContext(context);

        requestLogger?.info("Processing versioned message request", {
          name,
          userAgent,
        });

        return sendSuccess(
          context,
          {
            message: `hello ${name}`,
          },
          {
            meta: {
              module: "message",
            },
          }
        );
      },
      {
        params: t.Object({
          name: t.String(),
        }),
        detail: {
          tags: ["Message"],
          summary: "Versioned message endpoint",
          description: "Returns a greeting message for the provided name.",
        },
        response: {
          200: t.Any(),
        },
      }
    );
}
