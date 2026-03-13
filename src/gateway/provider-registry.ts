/**
 * @file apps/api/src/gateway/provider-registry.ts
 * @author Guy Romelle Magayano
 * @description Provider registry for resolving gateway integrations.
 */

import type { ILogger } from "@portfolio/logger";

import type { ApiRuntimeConfig } from "../config/env.js";
import type { ContentProvider } from "../providers/content/content.provider.js";
import { createLocalContentProvider } from "../providers/content/local-content.provider.js";
import { createStaticContentProvider } from "../providers/content/static-content.provider.js";

export type ProviderRegistry = {
  content: ContentProvider;
};

/** Resolves the configured content provider. */
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

  logger.info("Using local content provider", {
    provider: "local",
  });

  return createLocalContentProvider();
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
