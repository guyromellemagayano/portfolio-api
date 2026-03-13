/**
 * @file apps/api/api/index.js
 * @author Guy Romelle Magayano
 * @description Vercel Bun root function entrypoint for the API gateway.
 */

import { vercelApiGatewayHandler } from "../dist/index.js";

export default {
  fetch: vercelApiGatewayHandler,
};
