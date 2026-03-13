/**
 * @file apps/api/src/modules/content/__tests__/content.routes.contract.test.ts
 * @author Guy Romelle Magayano
 * @description Contract tests for content routes using Elysia runtime request handling.
 */

import { Elysia } from "elysia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTENT_ARTICLES_ROUTE,
  CONTENT_PAGES_ROUTE,
  getContentArticleRoute,
  getContentPageRoute,
} from "@portfolio/api-contracts/content";
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  CORRELATION_ID_HEADER,
  getSanityUpstreamFailureMessage,
} from "@portfolio/api-contracts/http";

import { createApiLogger } from "@api/config/logger";
import { GatewayError } from "@api/contracts/errors";
import { createErrorHandlerPlugin } from "@api/middleware/error-handler";
import { createRequestContextPlugin } from "@api/middleware/request-context";
import { createContentRouter } from "@api/modules/content/content.routes";
import type { ContentService } from "@api/modules/content/content.service";

function createContentServiceMock(
  overrides: Partial<ContentService> = {}
): ContentService {
  return {
    providerName: "static",
    getArticles: vi.fn().mockResolvedValue([]),
    getArticleBySlug: vi.fn().mockResolvedValue(null),
    getPages: vi.fn().mockResolvedValue([]),
    getPageBySlug: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function createContentTestApp(contentService: ContentService) {
  const logger = createApiLogger("test");

  return new Elysia()
    .use(createRequestContextPlugin(logger))
    .use(createErrorHandlerPlugin(logger))
    .use(createContentRouter(contentService));
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("GET /v1/content/articles contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the standard success envelope with request metadata and correlation ID", async () => {
    const app = createContentTestApp(
      createContentServiceMock({
        getArticles: vi.fn().mockResolvedValue([]),
      })
    );
    const response = await app.handle(
      new Request(`http://localhost${CONTENT_ARTICLES_ROUTE}`, {
        headers: {
          [CORRELATION_ID_HEADER]: "corr-test-articles-success",
        },
      })
    );
    const body = await parseJsonResponse<{
      success: boolean;
      data: unknown[];
      meta: {
        correlationId: string;
        provider: string;
        count: number;
        module: string;
        requestId: string;
        timestamp: string;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe(
      "corr-test-articles-success"
    );
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    expect(body).toMatchObject({
      success: true,
      data: [],
      meta: {
        correlationId: "corr-test-articles-success",
        provider: "static",
        count: 0,
        module: "content",
      },
    });
    expect(typeof body.meta.requestId).toBe("string");
    expect(body.meta.requestId.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(body.meta.timestamp))).toBe(false);
  });

  it("returns the standard error envelope when the route propagates a provider error", async () => {
    const app = createContentTestApp(
      createContentServiceMock({
        providerName: "sanity",
        getArticles: vi.fn().mockRejectedValue(
          new GatewayError({
            statusCode: 502,
            code: API_ERROR_CODES.SANITY_UPSTREAM_ERROR,
            message: getSanityUpstreamFailureMessage("articles"),
            details: {
              status: 503,
            },
          })
        ),
      })
    );
    const response = await app.handle(
      new Request(`http://localhost${CONTENT_ARTICLES_ROUTE}`, {
        headers: {
          [CORRELATION_ID_HEADER]: "corr-test-articles-error",
        },
      })
    );
    const body = await parseJsonResponse<{
      success: boolean;
      error: {
        code: string;
        message: string;
        details: {
          status: number;
        };
      };
      meta: {
        correlationId: string;
        requestId: string;
        timestamp: string;
      };
    }>(response);

    expect(response.status).toBe(502);
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe(
      "corr-test-articles-error"
    );
    expect(body).toMatchObject({
      success: false,
      error: {
        code: API_ERROR_CODES.SANITY_UPSTREAM_ERROR,
        message: getSanityUpstreamFailureMessage("articles"),
        details: {
          status: 503,
        },
      },
      meta: {
        correlationId: "corr-test-articles-error",
      },
    });
    expect(typeof body.meta.requestId).toBe("string");
    expect(Number.isNaN(Date.parse(body.meta.timestamp))).toBe(false);
  });
});

describe("GET /v1/content/articles/:slug contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the standard success envelope for article detail", async () => {
    const app = createContentTestApp(
      createContentServiceMock({
        providerName: "sanity",
        getArticleBySlug: vi.fn().mockResolvedValue({
          id: "article-1",
          title: "Example Article",
          slug: "example-article",
          publishedAt: "2026-02-24T00:00:00.000Z",
          excerpt: "Summary",
          seoDescription: "SEO Summary",
          imageUrl: "https://cdn.example.com/article.jpg",
          imageAlt: "Example article cover",
          tags: ["engineering"],
          body: [
            {
              _type: "block",
              style: "normal",
              children: [
                {
                  _type: "span",
                  text: "Hello world",
                },
              ],
            },
          ],
        }),
      })
    );
    const response = await app.handle(
      new Request(
        `http://localhost${getContentArticleRoute("example-article")}`,
        {
          headers: {
            [CORRELATION_ID_HEADER]: "corr-test-article-detail-success",
          },
        }
      )
    );
    const body = await parseJsonResponse<{
      success: boolean;
      data: {
        slug: string;
        body: unknown[];
      };
      meta: {
        correlationId: string;
        provider: string;
        slug: string;
        module: string;
        resource: string;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    expect(body).toMatchObject({
      success: true,
      data: {
        slug: "example-article",
        body: expect.any(Array),
      },
      meta: {
        correlationId: "corr-test-article-detail-success",
        provider: "sanity",
        slug: "example-article",
        module: "content",
        resource: "article",
      },
    });
  });

  it("returns the standard error envelope for a missing article", async () => {
    const app = createContentTestApp(
      createContentServiceMock({
        providerName: "sanity",
        getArticleBySlug: vi.fn().mockResolvedValue(null),
      })
    );
    const response = await app.handle(
      new Request(
        `http://localhost${getContentArticleRoute("missing-article")}`,
        {
          headers: {
            [CORRELATION_ID_HEADER]: "corr-test-article-detail-missing",
          },
        }
      )
    );
    const body = await parseJsonResponse<{
      success: boolean;
      error: {
        code: string;
        message: string;
        details: {
          slug: string;
        };
      };
      meta: {
        correlationId: string;
      };
    }>(response);

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: API_ERROR_CODES.CONTENT_ARTICLE_NOT_FOUND,
        message: API_ERROR_MESSAGES.CONTENT_ARTICLE_NOT_FOUND,
        details: {
          slug: "missing-article",
        },
      },
      meta: {
        correlationId: "corr-test-article-detail-missing",
      },
    });
  });

  it("returns the standard error envelope when article detail lookup fails upstream", async () => {
    const slug = "some-slug";
    const app = createContentTestApp(
      createContentServiceMock({
        providerName: "sanity",
        getArticleBySlug: vi.fn().mockRejectedValue(
          new GatewayError({
            statusCode: 502,
            code: API_ERROR_CODES.SANITY_UPSTREAM_ERROR,
            message: getSanityUpstreamFailureMessage("articles"),
            details: {
              slug,
            },
          })
        ),
      })
    );
    const response = await app.handle(
      new Request(`http://localhost${getContentArticleRoute(slug)}`, {
        headers: {
          [CORRELATION_ID_HEADER]: "corr-test-article-detail-upstream-error",
        },
      })
    );
    const body = await parseJsonResponse<{
      success: boolean;
      error: {
        code: string;
        message: string;
        details: {
          slug: string;
        };
      };
      meta: {
        correlationId: string;
      };
    }>(response);

    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: API_ERROR_CODES.SANITY_UPSTREAM_ERROR,
        message: getSanityUpstreamFailureMessage("articles"),
        details: {
          slug,
        },
      },
      meta: {
        correlationId: "corr-test-article-detail-upstream-error",
      },
    });
  });
});

describe("GET /v1/content/pages contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the standard success envelope with page list metadata", async () => {
    const app = createContentTestApp(
      createContentServiceMock({
        providerName: "sanity",
        getPages: vi.fn().mockResolvedValue([
          {
            id: "page-1",
            slug: "now",
            title: "Now",
            subheading: "Now",
            intro: "What I am focused on right now.",
            updatedAt: "2026-02-25T00:00:00.000Z",
            hideFromSitemap: false,
            seoNoIndex: false,
          },
        ]),
      })
    );
    const response = await app.handle(
      new Request(`http://localhost${CONTENT_PAGES_ROUTE}`, {
        headers: {
          [CORRELATION_ID_HEADER]: "corr-test-pages-success",
        },
      })
    );
    const body = await parseJsonResponse<{
      success: boolean;
      data: Array<{
        slug: string;
        title: string;
        hideFromSitemap: boolean;
        seoNoIndex: boolean;
      }>;
      meta: {
        correlationId: string;
        provider: string;
        count: number;
        module: string;
        resource: string;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    expect(body).toMatchObject({
      success: true,
      data: [
        {
          slug: "now",
          title: "Now",
          hideFromSitemap: false,
          seoNoIndex: false,
        },
      ],
      meta: {
        correlationId: "corr-test-pages-success",
        provider: "sanity",
        count: 1,
        module: "content",
        resource: "page",
      },
    });
  });
});

describe("GET /v1/content/pages/:slug contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the standard success envelope for page detail", async () => {
    const app = createContentTestApp(
      createContentServiceMock({
        providerName: "sanity",
        getPageBySlug: vi.fn().mockResolvedValue({
          id: "page-1",
          slug: "now",
          title: "Now",
          subheading: "Now",
          intro: "What I am focused on right now.",
          updatedAt: "2026-02-25T00:00:00.000Z",
          hideFromSitemap: true,
          seoTitle: "Now | SEO",
          seoDescription: "Current focus areas and priorities.",
          seoCanonicalPath: "/now",
          seoNoIndex: true,
          seoNoFollow: true,
          seoOgTitle: "Now OG",
          seoOgDescription: "Now Open Graph Description",
          seoOgImageUrl: "https://cdn.example.com/pages/now-og.jpg",
          seoOgImageWidth: 1200,
          seoOgImageHeight: 630,
          seoOgImageAlt: "Now OG image alt text",
          seoTwitterCard: "summary_large_image",
          body: [
            {
              _type: "block",
              style: "normal",
              children: [
                {
                  _type: "span",
                  text: "Shipping Sanity-backed pages.",
                },
              ],
            },
          ],
        }),
      })
    );
    const response = await app.handle(
      new Request(`http://localhost${getContentPageRoute("now")}`, {
        headers: {
          [CORRELATION_ID_HEADER]: "corr-test-page-detail-success",
        },
      })
    );
    const body = await parseJsonResponse<{
      success: boolean;
      data: {
        slug: string;
        hideFromSitemap: boolean;
        seoTitle: string;
        seoCanonicalPath: string;
        seoNoIndex: boolean;
        seoNoFollow: boolean;
        seoTwitterCard: string;
        body: unknown[];
      };
      meta: {
        correlationId: string;
        provider: string;
        slug: string;
        module: string;
        resource: string;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    expect(body).toMatchObject({
      success: true,
      data: {
        slug: "now",
        hideFromSitemap: true,
        seoTitle: "Now | SEO",
        seoCanonicalPath: "/now",
        seoNoIndex: true,
        seoNoFollow: true,
        seoTwitterCard: "summary_large_image",
        body: expect.any(Array),
      },
      meta: {
        correlationId: "corr-test-page-detail-success",
        provider: "sanity",
        slug: "now",
        module: "content",
        resource: "page",
      },
    });
  });

  it("returns the standard error envelope for a missing page slug", async () => {
    const app = createContentTestApp(
      createContentServiceMock({
        providerName: "sanity",
        getPageBySlug: vi.fn().mockResolvedValue(null),
      })
    );
    const response = await app.handle(
      new Request(`http://localhost${getContentPageRoute("missing-page")}`, {
        headers: {
          [CORRELATION_ID_HEADER]: "corr-test-page-detail-missing",
        },
      })
    );
    const body = await parseJsonResponse<{
      success: boolean;
      error: {
        code: string;
        message: string;
        details: {
          slug: string;
        };
      };
      meta: {
        correlationId: string;
      };
    }>(response);

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: API_ERROR_CODES.CONTENT_PAGE_NOT_FOUND,
        message: API_ERROR_MESSAGES.CONTENT_PAGE_NOT_FOUND,
        details: {
          slug: "missing-page",
        },
      },
      meta: {
        correlationId: "corr-test-page-detail-missing",
      },
    });
  });
});
