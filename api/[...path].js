/**
 * @file apps/api/api/[...path].js
 * @author Guy Romelle Magayano
 * @description Vercel Bun catch-all function entrypoint for the API gateway.
 */

import { vercelApiGatewayHandler } from "../dist/index.js";

export default {
  fetch: vercelApiGatewayHandler,
};
