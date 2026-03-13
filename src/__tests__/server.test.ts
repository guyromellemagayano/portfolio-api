/**
 * @file apps/api/src/__tests__/server.test.ts
 * @author Guy Romelle Magayano
 * @description Unit tests for API gateway composition and provider resolution.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  API_ROOT_ROUTE,
  HEALTH_ROUTE_STATUS,
  OPENAPI_JSON_ROUTE,
} from "@portfolio/api-contracts/http";

import { getApiConfig } from "@api/config/env";
import { API_ENV_KEYS } from "@api/config/env-keys";
import { createApiLogger } from "@api/config/logger";
import { createProviderRegistry } from "@api/gateway/provider-registry";
import { createServer, resolveCorsOrigin } from "@api/server";

describe("API gateway server", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("creates an Elysia application instance", () => {
    const app = createServer();

    expect(app).toBeDefined();
    expect(typeof app).toBe("object");
    expect(typeof app.handle).toBe("function");
    expect(typeof app.listen).toBe("function");
  });

  it("redirects the root route to the latest versioned health endpoint", async () => {
    const app = createServer();
    const response = await app.handle(
      new Request(`http://localhost${API_ROOT_ROUTE}`)
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(HEALTH_ROUTE_STATUS);
  });

  it("exposes OpenAPI JSON at /openapi/json", async () => {
    const app = createServer();
    const response = await app.handle(
      new Request(`http://localhost${OPENAPI_JSON_ROUTE}`)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("parses API gateway environment values", () => {
    vi.stubEnv(API_ENV_KEYS.API_PORT, "7001");
    vi.stubEnv(
      API_ENV_KEYS.API_GATEWAY_CORS_ORIGINS,
      "http://localhost:3000,https://admin.example.com"
    );
    vi.stubEnv(API_ENV_KEYS.API_GATEWAY_CONTENT_PROVIDER, "static");

    const config = getApiConfig();

    expect(config.port).toBe(7001);
    expect(config.corsOrigins).toEqual([
      "http://localhost:3000",
      "https://admin.example.com",
    ]);
    expect(config.integrations.contentProvider).toBe("static");
  });

  it("uses local content provider by default", () => {
    vi.stubEnv(API_ENV_KEYS.API_GATEWAY_CONTENT_PROVIDER, "");

    const config = getApiConfig();
    const logger = createApiLogger(config.nodeEnv);
    const providers = createProviderRegistry(config, logger);

    expect(providers.content.name).toBe("local");
  });

  it("uses static content provider when explicitly configured", () => {
    vi.stubEnv(API_ENV_KEYS.API_GATEWAY_CONTENT_PROVIDER, "static");

    const config = getApiConfig();
    const logger = createApiLogger(config.nodeEnv);
    const providers = createProviderRegistry(config, logger);

    expect(providers.content.name).toBe("static");
  });

  it("falls back to local provider for unknown provider values", () => {
    vi.stubEnv(API_ENV_KEYS.API_GATEWAY_CONTENT_PROVIDER, "unknown-provider");

    const config = getApiConfig();
    const logger = createApiLogger(config.nodeEnv);
    const providers = createProviderRegistry(config, logger);

    expect(providers.content.name).toBe("local");
  });

  it("allows CORS in development when allowlist is not configured", () => {
    vi.stubEnv(API_ENV_KEYS.NODE_ENV, "development");
    vi.stubEnv(API_ENV_KEYS.API_GATEWAY_CORS_ORIGINS, "");

    const config = getApiConfig();
    expect(resolveCorsOrigin(config)).toBe(true);
  });

  it("disables CORS in production when allowlist is empty", () => {
    vi.stubEnv(API_ENV_KEYS.NODE_ENV, "production");
    vi.stubEnv(API_ENV_KEYS.API_GATEWAY_CORS_ORIGINS, "");

    const config = getApiConfig();
    expect(resolveCorsOrigin(config)).toBe(false);
  });

  it("allows only configured CORS origins in production", () => {
    vi.stubEnv(API_ENV_KEYS.NODE_ENV, "production");
    vi.stubEnv(
      API_ENV_KEYS.API_GATEWAY_CORS_ORIGINS,
      "https://web.example.com"
    );

    const config = getApiConfig();
    expect(resolveCorsOrigin(config)).toEqual(["https://web.example.com"]);
  });
});
