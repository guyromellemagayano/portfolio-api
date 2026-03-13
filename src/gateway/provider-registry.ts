/**
 * @file apps/api/src/gateway/provider-registry.ts
 * @author Guy Romelle Magayano
 * @description Provider registry for resolving gateway integrations.
 */

import type { ILogger } from "@portfolio/logger";

import type { ApiRuntimeConfig } from "../config/env.js";
import { API_ENV_KEYS } from "../config/env-keys.js";
import type { ContentProvider } from "../providers/content/content.provider.js";
import { createSanityContentProvider } from "../providers/content/sanity-content.provider.js";
import { createStaticContentProvider } from "../providers/content/static-content.provider.js";

export type ProviderRegistry = {
  content: ContentProvider;
};

export const SANITY_PROVIDER_MISSING_SERVER_ENV_PRODUCTION_MESSAGE = `Sanity content provider is configured but ${API_ENV_KEYS.SANITY_STUDIO_PROJECT_ID}/${API_ENV_KEYS.SANITY_STUDIO_DATASET} are missing in production.`;

export const SANITY_PROVIDER_FALLBACK_TO_STATIC_MESSAGE = `Sanity provider requested but ${API_ENV_KEYS.SANITY_STUDIO_PROJECT_ID}/${API_ENV_KEYS.SANITY_STUDIO_DATASET} are missing. Falling back to static provider.`;

/** Resolves the configured content provider and applies non-production fallback behavior when Sanity is unavailable. */
function resolveContentProvider(
  config: ApiRuntimeConfig,
  logger: ILogger
): ContentProvider {
  const requestedProvider = config.integrations.contentProvider;

  if (requestedProvider === "static") {
    logger.info("Using static content provider", {
      provider: "static",
    });

    return createStaticContentProvider();
  }

  const sanityConfig = config.integrations.sanity;

  if (!sanityConfig.projectId || !sanityConfig.dataset) {
    if (config.nodeEnv === "production") {
      throw new Error(SANITY_PROVIDER_MISSING_SERVER_ENV_PRODUCTION_MESSAGE);
    }

    logger.warn(SANITY_PROVIDER_FALLBACK_TO_STATIC_MESSAGE, {
      provider: "sanity",
    });

    return createStaticContentProvider();
  }

  logger.info("Using Sanity content provider", {
    provider: "sanity",
    projectId: sanityConfig.projectId,
    dataset: sanityConfig.dataset,
    apiVersion: sanityConfig.apiVersion,
  });

  return createSanityContentProvider(
    {
      projectId: sanityConfig.projectId,
      dataset: sanityConfig.dataset,
      apiVersion: sanityConfig.apiVersion,
      readToken: sanityConfig.readToken,
      useCdn: sanityConfig.useCdn,
      requestTimeoutMs: sanityConfig.requestTimeoutMs,
      maxRetries: sanityConfig.maxRetries,
      retryDelayMs: sanityConfig.retryDelayMs,
    },
    logger
  );
}

/** Builds the provider registry consumed by feature modules. */
export function createProviderRegistry(
  config: ApiRuntimeConfig,
  logger: ILogger
): ProviderRegistry {
  return {
    content: resolveContentProvider(config, logger),
  };
}
