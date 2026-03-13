/**
 * @file apps/api/src/platform/vercel.ts
 * @author Guy Romelle Magayano
 * @description Vercel Bun Function adapter for the API gateway Elysia app.
 */

import {
  API_ROOT_ROUTE,
  VERCEL_API_ROUTE_PREFIX,
} from "@portfolio/api-contracts/http";

import { createServer } from "../server.js";

let cachedServer: ReturnType<typeof createServer> | null = null;

/** Lazily creates and memoizes the Elysia app for warm Vercel invocations. */
function getCachedServer(): ReturnType<typeof createServer> {
  if (!cachedServer) {
    cachedServer = createServer();
  }

  return cachedServer;
}

/** Normalizes rewritten Vercel function URLs so Elysia receives root-domain API routes. */
export function normalizeVercelApiGatewayRequestUrl(url: string): string {
  const normalizedUrl = url.trim() || API_ROOT_ROUTE;
  const hasApiPrefix =
    normalizedUrl === VERCEL_API_ROUTE_PREFIX ||
    normalizedUrl.startsWith(`${VERCEL_API_ROUTE_PREFIX}/`) ||
    normalizedUrl.startsWith(`${VERCEL_API_ROUTE_PREFIX}?`);
  const strippedApiPrefix = hasApiPrefix
    ? normalizedUrl.slice(VERCEL_API_ROUTE_PREFIX.length)
    : normalizedUrl;

  if (!strippedApiPrefix) {
    return API_ROOT_ROUTE;
  }

  if (strippedApiPrefix.startsWith("?")) {
    return `${API_ROOT_ROUTE}${strippedApiPrefix}`;
  }

  return strippedApiPrefix;
}

/** Handles Vercel Bun Function requests by delegating to the Elysia Web handler. */
export default async function vercelApiGatewayHandler(
  request: Request
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const normalizedPath = normalizeVercelApiGatewayRequestUrl(
    `${requestUrl.pathname}${requestUrl.search}` || API_ROOT_ROUTE
  );
  const normalizedRequestUrl = new URL(normalizedPath, requestUrl.origin);
  const app = getCachedServer();

  const appRequest = new Request(normalizedRequestUrl.toString(), request);
  return app.handle(appRequest);
}
