/**
 * @file apps/api/src/modules/health/__tests__/health.routes.test.ts
 * @author Guy Romelle Magayano
 * @description Unit tests for health route redirect and versioned route registration behavior.
 */

import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";

import {
  CORRELATION_ID_HEADER,
  HEALTH_ROUTE_LEGACY,
  HEALTH_ROUTE_STATUS,
} from "@portfolio/api-contracts/http";

import { createApiLogger } from "@api/config/logger";
import { createErrorHandlerPlugin } from "@api/middleware/error-handler";
import { createRequestContextPlugin } from "@api/middleware/request-context";
import { createHealthRouter } from "@api/modules/health/health.routes";

function createHealthTestApp() {
  const logger = createApiLogger("test");

  return new Elysia()
    .use(createRequestContextPlugin(logger))
    .use(createErrorHandlerPlugin(logger))
    .use(createHealthRouter());
}

describe("health routes", () => {
  it("redirects the legacy /status route to /v1/status", async () => {
    const app = createHealthTestApp();
    const response = await app.handle(
      new Request(`http://localhost${HEALTH_ROUTE_LEGACY}`)
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(HEALTH_ROUTE_STATUS);
  });

  it("returns success envelope for /v1/status", async () => {
    const app = createHealthTestApp();
    const response = await app.handle(
      new Request(`http://localhost${HEALTH_ROUTE_STATUS}`)
    );
    const payload = (await response.json()) as {
      success: boolean;
      data: {
        ok: boolean;
      };
      meta: {
        service: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.ok).toBe(true);
    expect(payload.meta.service).toBe("api-gateway");
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBeTruthy();
  });
});
