/**
 * @file apps/api/src/modules/message/__tests__/message.routes.test.ts
 * @author Guy Romelle Magayano
 * @description Unit tests for message route redirect behavior.
 */

import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";

import {
  CORRELATION_ID_HEADER,
  getMessageRoute,
  MESSAGE_ROUTE_LEGACY_PATTERN,
} from "@portfolio/api-contracts/http";

import { createApiLogger } from "@api/config/logger";
import { createErrorHandlerPlugin } from "@api/middleware/error-handler";
import { createRequestContextPlugin } from "@api/middleware/request-context";
import { createMessageRouter } from "@api/modules/message/message.routes";

function createMessageTestApp() {
  const logger = createApiLogger("test");

  return new Elysia()
    .use(createRequestContextPlugin(logger))
    .use(createErrorHandlerPlugin(logger))
    .use(createMessageRouter());
}

describe("message routes", () => {
  it("redirects the legacy /message/:name route to the versioned route", async () => {
    const app = createMessageTestApp();
    const response = await app.handle(
      new Request(
        `http://localhost${MESSAGE_ROUTE_LEGACY_PATTERN.replace(
          ":name",
          encodeURIComponent("Guy Romelle")
        )}`
      )
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      getMessageRoute("Guy Romelle")
    );
  });

  it("returns message envelope for /v1/message/:name", async () => {
    const app = createMessageTestApp();
    const response = await app.handle(
      new Request(`http://localhost${getMessageRoute("Guy")}`)
    );
    const payload = (await response.json()) as {
      success: boolean;
      data: {
        message: string;
      };
      meta: {
        module: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.message).toBe("hello Guy");
    expect(payload.meta.module).toBe("message");
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBeTruthy();
  });
});
