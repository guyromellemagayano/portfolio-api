/**
 * @file apps/api/src/config/env.ts
 * @author Guy Romelle Magayano
 * @description Runtime environment parsing for API gateway configuration.
 */

import { API_ENV_KEYS, type ApiEnvKey } from "./env-keys.js";

const DEFAULT_API_PORT = 5001;
const DEFAULT_SANITY_API_VERSION = "2025-02-19";
const DEFAULT_CONTENT_PROVIDER = "sanity";
const DEFAULT_SANITY_REQUEST_TIMEOUT_MS = 8_000;
const DEFAULT_SANITY_REQUEST_MAX_RETRIES = 1;
const DEFAULT_SANITY_REQUEST_RETRY_DELAY_MS = 250;

export type ApiRuntimeEnvironment = "development" | "test" | "production";
export type ContentProviderKind = "sanity" | "static";

export type SanityProviderConfig = {
  projectId?: string;
  dataset?: string;
  apiVersion: string;
  readToken?: string;
  useCdn: boolean;
  requestTimeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
};

export type ApiRuntimeConfig = {
  nodeEnv: ApiRuntimeEnvironment;
  port: number;
  corsOrigins: string[];
  integrations: {
    contentProvider: ContentProviderKind;
    sanity: SanityProviderConfig;
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

/** Parses common boolean env formats while preserving a fallback default. */
function parseBoolean(rawValue: string, fallback: boolean): boolean {
  if (!rawValue) {
    return fallback;
  }

  const normalizedValue = rawValue.toLowerCase();
  return normalizedValue === "true" || normalizedValue === "1";
}

/** Parses an integer env value with optional bounds validation. */
function parseInteger(
  rawValue: string,
  fallback: number,
  options: {
    min?: number;
    max?: number;
  } = {}
): number {
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  if (options.min !== undefined && parsedValue < options.min) {
    return fallback;
  }

  if (options.max !== undefined && parsedValue > options.max) {
    return fallback;
  }

  return parsedValue;
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

/** Resolves the content provider kind with `sanity` as the default. */
function parseContentProvider(rawProvider: string): ContentProviderKind {
  const normalizedProvider = rawProvider.toLowerCase();

  if (normalizedProvider === "static") {
    return "static";
  }

  return "sanity";
}

/** Prefers a server-only env var and optionally falls back to a public env var outside production. */
function resolveServerFirstEnvVar(
  nodeEnv: ApiRuntimeEnvironment,
  serverKey: ApiEnvKey,
  publicKey: ApiEnvKey
): string | undefined {
  const serverValue = getEnvVar(serverKey);

  if (serverValue) {
    return serverValue;
  }

  if (nodeEnv === "production") {
    return undefined;
  }

  const publicValue = getEnvVar(publicKey);
  return publicValue || undefined;
}

/** Resolves the Sanity project id with production-safe server-first behavior. */
function resolveSanityProjectId(
  nodeEnv: ApiRuntimeEnvironment
): string | undefined {
  return resolveServerFirstEnvVar(
    nodeEnv,
    API_ENV_KEYS.SANITY_STUDIO_PROJECT_ID,
    API_ENV_KEYS.NEXT_PUBLIC_SANITY_PROJECT_ID
  );
}

/** Resolves the Sanity dataset with production-safe server-first behavior. */
function resolveSanityDataset(
  nodeEnv: ApiRuntimeEnvironment
): string | undefined {
  return resolveServerFirstEnvVar(
    nodeEnv,
    API_ENV_KEYS.SANITY_STUDIO_DATASET,
    API_ENV_KEYS.NEXT_PUBLIC_SANITY_DATASET
  );
}

/** Resolves the Sanity API version with a deterministic fallback. */
function resolveSanityApiVersion(nodeEnv: ApiRuntimeEnvironment): string {
  const serverApiVersion = getEnvVar(API_ENV_KEYS.SANITY_API_VERSION);

  if (serverApiVersion) {
    return serverApiVersion;
  }

  if (nodeEnv !== "production") {
    const publicApiVersion = getEnvVar(
      API_ENV_KEYS.NEXT_PUBLIC_SANITY_API_VERSION
    );

    if (publicApiVersion) {
      return publicApiVersion;
    }
  }

  return DEFAULT_SANITY_API_VERSION;
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
      sanity: {
        projectId: resolveSanityProjectId(nodeEnv),
        dataset: resolveSanityDataset(nodeEnv),
        apiVersion: resolveSanityApiVersion(nodeEnv),
        readToken: getEnvVar(API_ENV_KEYS.SANITY_API_READ_TOKEN) || undefined,
        useCdn: parseBoolean(getEnvVar(API_ENV_KEYS.SANITY_USE_CDN), true),
        requestTimeoutMs: parseInteger(
          getEnvVar(API_ENV_KEYS.SANITY_REQUEST_TIMEOUT_MS),
          DEFAULT_SANITY_REQUEST_TIMEOUT_MS,
          {
            min: 100,
            max: 60_000,
          }
        ),
        maxRetries: parseInteger(
          getEnvVar(API_ENV_KEYS.SANITY_REQUEST_MAX_RETRIES),
          DEFAULT_SANITY_REQUEST_MAX_RETRIES,
          {
            min: 0,
            max: 5,
          }
        ),
        retryDelayMs: parseInteger(
          getEnvVar(API_ENV_KEYS.SANITY_REQUEST_RETRY_DELAY_MS),
          DEFAULT_SANITY_REQUEST_RETRY_DELAY_MS,
          {
            min: 0,
            max: 10_000,
          }
        ),
      },
    },
  };
}
