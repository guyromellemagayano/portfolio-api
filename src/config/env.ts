/**
 * @file apps/api/src/config/env.ts
 * @author Guy Romelle Magayano
 * @description Runtime environment parsing for API gateway configuration.
 */

import { API_ENV_KEYS, type ApiEnvKey } from "./env-keys.js";

const DEFAULT_API_PORT = 5001;
const DEFAULT_CONTENT_PROVIDER = "local";

export type ApiRuntimeEnvironment = "development" | "test" | "production";
export type ContentProviderKind = "local" | "static";

export type ApiRuntimeConfig = {
  nodeEnv: ApiRuntimeEnvironment;
  port: number;
  corsOrigins: string[];
  integrations: {
    contentProvider: ContentProviderKind;
  };
};

/** Reads and trims an environment variable value, returning an empty string when missing. */
function getEnvVar(key: ApiEnvKey): string {
  return globalThis?.process?.env?.[key]?.trim() ?? "";
}

/** Parses the API port with a safe fallback when the value is missing or invalid. */
function parsePort(rawPort: string): number {
  const port = Number.parseInt(rawPort, 10);

  if (!Number.isFinite(port) || port <= 0) {
    return DEFAULT_API_PORT;
  }

  return port;
}

/** Normalizes `NODE_ENV` into the gateway runtime environment union. */
function parseNodeEnv(rawNodeEnv: string): ApiRuntimeEnvironment {
  if (rawNodeEnv === "production") {
    return "production";
  }

  if (rawNodeEnv === "test") {
    return "test";
  }

  return "development";
}

/** Parses a comma-delimited CORS origin allowlist. */
function parseCorsOrigins(rawCorsOrigins: string): string[] {
  if (!rawCorsOrigins) {
    return [];
  }

  return rawCorsOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/** Resolves the content provider kind with `local` as the default. */
function parseContentProvider(rawProvider: string): ContentProviderKind {
  const normalizedProvider = rawProvider.toLowerCase();

  if (normalizedProvider === "static") {
    return "static";
  }

  return "local";
}

/** Builds and validates the API gateway runtime configuration from process env. */
export function getApiConfig(): ApiRuntimeConfig {
  const nodeEnv = parseNodeEnv(getEnvVar(API_ENV_KEYS.NODE_ENV));
  const port = parsePort(
    getEnvVar(API_ENV_KEYS.PORT) || getEnvVar(API_ENV_KEYS.API_PORT)
  );
  const corsOrigins = parseCorsOrigins(
    getEnvVar(API_ENV_KEYS.API_GATEWAY_CORS_ORIGINS)
  );
  const contentProvider = parseContentProvider(
    getEnvVar(API_ENV_KEYS.API_GATEWAY_CONTENT_PROVIDER) ||
      DEFAULT_CONTENT_PROVIDER
  );

  return {
    nodeEnv,
    port,
    corsOrigins,
    integrations: {
      contentProvider,
    },
  };
}
