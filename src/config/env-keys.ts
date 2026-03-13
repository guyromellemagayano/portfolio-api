/**
 * @file apps/api/src/config/env-keys.ts
 * @author Guy Romelle Magayano
 * @description Canonical environment variable keys consumed by the API gateway runtime.
 */

/** Canonical API gateway environment variable keys. */
export const API_ENV_KEYS = {
  NODE_ENV: "NODE_ENV",
  PORT: "PORT",
  API_PORT: "API_PORT",
  API_GATEWAY_CORS_ORIGINS: "API_GATEWAY_CORS_ORIGINS",
  API_GATEWAY_CONTENT_PROVIDER: "API_GATEWAY_CONTENT_PROVIDER",
} as const;

export type ApiEnvKey = (typeof API_ENV_KEYS)[keyof typeof API_ENV_KEYS];
