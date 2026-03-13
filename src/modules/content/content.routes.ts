/**
 * @file apps/api/src/modules/content/content.routes.ts
 * @author Guy Romelle Magayano
 * @description Versioned content routes exposed by the API gateway.
 */

import { Elysia, t } from "elysia";

import { CONTENT_ROUTE_PREFIX } from "@portfolio/api-contracts/content";
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
} from "@portfolio/api-contracts/http";
import type { ILogger } from "@portfolio/logger";

import { GatewayError } from "../../contracts/errors.js";
import { sendSuccess } from "../../contracts/http.js";
import type { ContentService } from "./content.service.js";

const responseMetaSchema = t.Object(
  {
    correlationId: t.String(),
    requestId: t.String(),
    timestamp: t.String(),
  },
  {
    additionalProperties: true,
  }
);

const successEnvelopeSchema = t.Object({
  success: t.Literal(true),
  data: t.Any(),
  meta: responseMetaSchema,
});

const errorEnvelopeSchema = t.Object({
  success: t.Literal(false),
  error: t.Object({
    code: t.String(),
    message: t.String(),
    details: t.Optional(t.Any()),
  }),
  meta: responseMetaSchema,
});
const CONTENT_CACHE_CONTROL_HEADER = "cache-control";
const CONTENT_CACHE_CONTROL_VALUE =
  "public, s-maxage=60, stale-while-revalidate=300";

/** Creates routes for content retrieval via the configured provider. */
export function createContentRouter(contentService: ContentService) {
  return new Elysia({
    name: "api-content-routes",
    prefix: CONTENT_ROUTE_PREFIX,
  })
    .get(
      "/articles",
      async (context) => {
        const requestLogger =
          "logger" in context ? (context as { logger?: ILogger }).logger : null;
        const articles = await contentService.getArticles();

        requestLogger?.info("Serving content articles", {
          provider: contentService.providerName,
          count: articles.length,
        });
        context.set.headers[CONTENT_CACHE_CONTROL_HEADER] =
          CONTENT_CACHE_CONTROL_VALUE;

        return sendSuccess(context, articles, {
          meta: {
            provider: contentService.providerName,
            count: articles.length,
            module: "content",
          },
        });
      },
      {
        detail: {
          tags: ["Content"],
          summary: "List articles",
          description:
            "Returns canonical article list data from the configured content provider.",
        },
        response: {
          200: successEnvelopeSchema,
          502: errorEnvelopeSchema,
          500: errorEnvelopeSchema,
        },
      }
    )
    .get(
      "/articles/:slug",
      async (context) => {
        const requestLogger =
          "logger" in context ? (context as { logger?: ILogger }).logger : null;
        const articleSlug = context.params.slug?.trim();

        if (!articleSlug) {
          throw new GatewayError({
            statusCode: 400,
            code: API_ERROR_CODES.CONTENT_ARTICLE_SLUG_REQUIRED,
            message: API_ERROR_MESSAGES.CONTENT_ARTICLE_SLUG_REQUIRED,
          });
        }

        const article = await contentService.getArticleBySlug(articleSlug);

        if (!article) {
          throw new GatewayError({
            statusCode: 404,
            code: API_ERROR_CODES.CONTENT_ARTICLE_NOT_FOUND,
            message: API_ERROR_MESSAGES.CONTENT_ARTICLE_NOT_FOUND,
            details: {
              slug: articleSlug,
            },
          });
        }

        requestLogger?.info("Serving content article detail", {
          provider: contentService.providerName,
          slug: article.slug,
        });
        context.set.headers[CONTENT_CACHE_CONTROL_HEADER] =
          CONTENT_CACHE_CONTROL_VALUE;

        return sendSuccess(context, article, {
          meta: {
            provider: contentService.providerName,
            slug: article.slug,
            module: "content",
            resource: "article",
          },
        });
      },
      {
        params: t.Object({
          slug: t.String(),
        }),
        detail: {
          tags: ["Content"],
          summary: "Get article by slug",
          description:
            "Returns canonical article detail data for a specific article slug.",
        },
        response: {
          200: successEnvelopeSchema,
          400: errorEnvelopeSchema,
          404: errorEnvelopeSchema,
          502: errorEnvelopeSchema,
          500: errorEnvelopeSchema,
        },
      }
    )
    .get(
      "/pages",
      async (context) => {
        const requestLogger =
          "logger" in context ? (context as { logger?: ILogger }).logger : null;
        const pages = await contentService.getPages();

        requestLogger?.info("Serving content pages", {
          provider: contentService.providerName,
          count: pages.length,
        });
        context.set.headers[CONTENT_CACHE_CONTROL_HEADER] =
          CONTENT_CACHE_CONTROL_VALUE;

        return sendSuccess(context, pages, {
          meta: {
            provider: contentService.providerName,
            count: pages.length,
            module: "content",
            resource: "page",
          },
        });
      },
      {
        detail: {
          tags: ["Content"],
          summary: "List pages",
          description:
            "Returns canonical standalone page list data from the configured content provider.",
        },
        response: {
          200: successEnvelopeSchema,
          502: errorEnvelopeSchema,
          500: errorEnvelopeSchema,
        },
      }
    )
    .get(
      "/pages/:slug",
      async (context) => {
        const requestLogger =
          "logger" in context ? (context as { logger?: ILogger }).logger : null;
        const pageSlug = context.params.slug?.trim();

        if (!pageSlug) {
          throw new GatewayError({
            statusCode: 400,
            code: API_ERROR_CODES.CONTENT_PAGE_SLUG_REQUIRED,
            message: API_ERROR_MESSAGES.CONTENT_PAGE_SLUG_REQUIRED,
          });
        }

        const page = await contentService.getPageBySlug(pageSlug);

        if (!page) {
          throw new GatewayError({
            statusCode: 404,
            code: API_ERROR_CODES.CONTENT_PAGE_NOT_FOUND,
            message: API_ERROR_MESSAGES.CONTENT_PAGE_NOT_FOUND,
            details: {
              slug: pageSlug,
            },
          });
        }

        requestLogger?.info("Serving content page detail", {
          provider: contentService.providerName,
          slug: page.slug,
        });
        context.set.headers[CONTENT_CACHE_CONTROL_HEADER] =
          CONTENT_CACHE_CONTROL_VALUE;

        return sendSuccess(context, page, {
          meta: {
            provider: contentService.providerName,
            slug: page.slug,
            module: "content",
            resource: "page",
          },
        });
      },
      {
        params: t.Object({
          slug: t.String(),
        }),
        detail: {
          tags: ["Content"],
          summary: "Get page by slug",
          description:
            "Returns canonical standalone page detail data for a specific page slug.",
        },
        response: {
          200: successEnvelopeSchema,
          400: errorEnvelopeSchema,
          404: errorEnvelopeSchema,
          502: errorEnvelopeSchema,
          500: errorEnvelopeSchema,
        },
      }
    );
}
