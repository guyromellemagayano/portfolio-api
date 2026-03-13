/**
 * @file apps/api/src/middleware/not-found.ts
 * @author Guy Romelle Magayano
 * @description Catch-all handler for unknown API routes.
 */

import { Elysia } from "elysia";

import {
  API_ERROR_CODES,
  getRouteNotFoundMessage,
} from "@portfolio/api-contracts/http";

import { sendError } from "../contracts/http.js";

/** Creates a catch-all route for unknown API paths. */
export function createNotFoundHandler() {
  return new Elysia({
    name: "api-not-found",
  }).all("*", (context) => {
    const requestUrl = new URL(context.request.url);
    const requestPath = `${requestUrl.pathname}${requestUrl.search}`;

    return sendError(context, {
      statusCode: 404,
      code: API_ERROR_CODES.ROUTE_NOT_FOUND,
      message: getRouteNotFoundMessage(context.request.method, requestPath),
    });
  });
}
