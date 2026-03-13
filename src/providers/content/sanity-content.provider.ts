/**
 * @file apps/api/src/providers/content/sanity-content.provider.ts
 * @author Guy Romelle Magayano
 * @description Sanity-backed content provider for gateway article and page endpoints.
 */

import type {
  ContentPortableTextBlock,
  ContentPortableTextImageBlock,
} from "@portfolio/api-contracts/content";
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  getSanityNetworkFailureMessage,
  getSanityTimeoutMessage,
  getSanityUpstreamFailureMessage,
} from "@portfolio/api-contracts/http";
import type { ILogger } from "@portfolio/logger";

import type {
  GatewayArticle,
  GatewayArticleDetail,
} from "../../contracts/articles.js";
import { GatewayError } from "../../contracts/errors.js";
import type { GatewayPage, GatewayPageDetail } from "../../contracts/pages.js";
import type { ContentProvider } from "./content.provider.js";

export type CreateSanityContentProviderOptions = {
  projectId: string;
  dataset: string;
  apiVersion: string;
  readToken?: string;
  useCdn: boolean;
  requestTimeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
};

type SanityQueryResponse<T> = {
  result?: T;
};

type SanityArticlePayload = {
  _id: string;
  title?: string | null;
  slug?: string | null;
  publishedAt?: string | null;
  excerpt?: string | null;
  hideFromSitemap?: boolean | null;
  seoNoIndex?: boolean | null;
  imageUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  tags?: string[] | null;
};

type SanityArticleDetailPayload = SanityArticlePayload & {
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalPath?: string | null;
  seoNoIndex?: boolean | null;
  seoNoFollow?: boolean | null;
  seoOgTitle?: string | null;
  seoOgDescription?: string | null;
  seoOgImageUrl?: string | null;
  seoOgImageWidth?: number | null;
  seoOgImageHeight?: number | null;
  seoOgImageAlt?: string | null;
  seoTwitterCard?: string | null;
  imageAlt?: string | null;
  body?: unknown[] | null;
};

type SanityPagePayload = {
  _id: string;
  title?: string | null;
  slug?: string | null;
  subheading?: string | null;
  intro?: string | null;
  updatedAt?: string | null;
  hideFromSitemap?: boolean | null;
  seoNoIndex?: boolean | null;
};

type SanityPageDetailPayload = SanityPagePayload & {
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalPath?: string | null;
  seoNoIndex?: boolean | null;
  seoNoFollow?: boolean | null;
  seoOgTitle?: string | null;
  seoOgDescription?: string | null;
  seoOgImageUrl?: string | null;
  seoOgImageWidth?: number | null;
  seoOgImageHeight?: number | null;
  seoOgImageAlt?: string | null;
  seoTwitterCard?: string | null;
  body?: unknown[] | null;
};

const SANITY_ARTICLES_GROQ = `*[_type == "article" && defined(slug.current)] | order(publishedAt desc) {
  _id,
  title,
  "slug": slug.current,
  "publishedAt": coalesce(publishedAt, _createdAt),
  "excerpt": coalesce(excerpt, seo.description, ""),
  "hideFromSitemap": seo.hideFromSitemap,
  "seoNoIndex": seo.noIndex,
  "imageUrl": mainImage.asset->url,
  "imageWidth": mainImage.asset->metadata.dimensions.width,
  "imageHeight": mainImage.asset->metadata.dimensions.height,
  tags
}`;

const SANITY_ARTICLE_BY_SLUG_GROQ = `*[_type == "article" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  "publishedAt": coalesce(publishedAt, _createdAt),
  "excerpt": coalesce(excerpt, seo.description, ""),
  "hideFromSitemap": seo.hideFromSitemap,
  "seoTitle": seo.title,
  "seoDescription": seo.description,
  "seoCanonicalPath": seo.canonicalPath,
  "seoNoIndex": seo.noIndex,
  "seoNoFollow": seo.noFollow,
  "seoOgTitle": seo.ogTitle,
  "seoOgDescription": seo.ogDescription,
  "seoOgImageUrl": seo.ogImage.asset->url,
  "seoOgImageWidth": seo.ogImage.asset->metadata.dimensions.width,
  "seoOgImageHeight": seo.ogImage.asset->metadata.dimensions.height,
  "seoOgImageAlt": seo.ogImage.alt,
  "seoTwitterCard": seo.twitterCard,
  "imageUrl": mainImage.asset->url,
  "imageWidth": mainImage.asset->metadata.dimensions.width,
  "imageHeight": mainImage.asset->metadata.dimensions.height,
  "imageAlt": mainImage.alt,
  tags,
  "body": coalesce(body, [])[]{
    ...,
    _type == "image" => {
      ...,
      "asset": {
        "url": asset->url,
        "width": asset->metadata.dimensions.width,
        "height": asset->metadata.dimensions.height
      }
    }
  }
}`;

const SANITY_PAGES_GROQ = `*[_type == "page" && defined(slug.current)] | order(_updatedAt desc) {
  _id,
  title,
  "slug": slug.current,
  subheading,
  intro,
  "updatedAt": _updatedAt,
  "hideFromSitemap": seo.hideFromSitemap,
  "seoNoIndex": seo.noIndex
}`;

const SANITY_PAGE_BY_SLUG_GROQ = `*[_type == "page" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  subheading,
  intro,
  "updatedAt": _updatedAt,
  "hideFromSitemap": seo.hideFromSitemap,
  "seoTitle": seo.title,
  "seoDescription": seo.description,
  "seoCanonicalPath": seo.canonicalPath,
  "seoNoIndex": seo.noIndex,
  "seoNoFollow": seo.noFollow,
  "seoOgTitle": seo.ogTitle,
  "seoOgDescription": seo.ogDescription,
  "seoOgImageUrl": seo.ogImage.asset->url,
  "seoOgImageWidth": seo.ogImage.asset->metadata.dimensions.width,
  "seoOgImageHeight": seo.ogImage.asset->metadata.dimensions.height,
  "seoOgImageAlt": seo.ogImage.alt,
  "seoTwitterCard": seo.twitterCard,
  "body": coalesce(body, [])[]{
    ...,
    _type == "image" => {
      ...,
      "asset": {
        "url": asset->url,
        "width": asset->metadata.dimensions.width,
        "height": asset->metadata.dimensions.height
      }
    }
  }
}`;

const DEFAULT_SANITY_REQUEST_TIMEOUT_MS = 8_000;
const DEFAULT_SANITY_REQUEST_MAX_RETRIES = 1;
const DEFAULT_SANITY_REQUEST_RETRY_DELAY_MS = 250;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/** Builds a Sanity Data API query URL for a GROQ request with optional parameters. */
function createSanityQueryUrl(
  options: CreateSanityContentProviderOptions,
  query: string,
  params?: Record<string, string>
): string {
  const baseHost = options.useCdn ? "apicdn.sanity.io" : "api.sanity.io";
  const queryParameters = new URLSearchParams({
    query,
  });

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      queryParameters.set(`$${key}`, value);
    }
  }

  return `https://${options.projectId}.${baseHost}/v${options.apiVersion}/data/query/${options.dataset}?${queryParameters.toString()}`;
}

/** Normalizes Sanity numeric dimensions into positive rounded integers. */
function toOptionalPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value);
}

/** Normalizes optional non-empty strings for gateway-safe payload fields. */
function toOptionalNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
}

/** Normalizes optional booleans for gateway-safe payload fields. */
function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** Normalizes supported Twitter card values. */
function toOptionalTwitterCard(
  value: unknown
): GatewayArticleDetail["seoTwitterCard"] {
  if (value === "summary" || value === "summary_large_image") {
    return value;
  }

  return undefined;
}

/** Maps a Sanity article summary document into the gateway article contract. */
function mapSanityArticle(
  payload: SanityArticlePayload
): GatewayArticle | null {
  const title = payload.title?.trim();
  const slug = payload.slug?.trim();
  const publishedAt = payload.publishedAt?.trim();

  if (!title || !slug || !publishedAt) {
    return null;
  }

  return {
    id: payload._id,
    title,
    slug,
    publishedAt,
    excerpt: payload.excerpt?.trim() ?? "",
    hideFromSitemap: toOptionalBoolean(payload.hideFromSitemap),
    seoNoIndex: toOptionalBoolean(payload.seoNoIndex),
    imageUrl: payload.imageUrl?.trim() || undefined,
    imageWidth: toOptionalPositiveNumber(payload.imageWidth),
    imageHeight: toOptionalPositiveNumber(payload.imageHeight),
    tags:
      payload.tags?.map((tag) => tag.trim()).filter((tag) => tag.length > 0) ??
      [],
  };
}

/** Normalizes a Sanity Portable Text block into a gateway-safe block or image block shape. */
function normalizePortableTextBlock(
  rawBlock: unknown
): ContentPortableTextBlock | ContentPortableTextImageBlock | null {
  if (!rawBlock || typeof rawBlock !== "object" || Array.isArray(rawBlock)) {
    return null;
  }

  const sourceBlock = rawBlock as Record<string, unknown>;
  const blockType =
    typeof sourceBlock._type === "string" ? sourceBlock._type : "";

  if (!blockType) {
    return null;
  }

  if (blockType === "image") {
    const assetValue =
      sourceBlock.asset && typeof sourceBlock.asset === "object"
        ? (sourceBlock.asset as Record<string, unknown>)
        : undefined;
    const imageUrl =
      typeof assetValue?.url === "string" ? assetValue.url.trim() : undefined;
    const imageWidth = toOptionalPositiveNumber(assetValue?.width);
    const imageHeight = toOptionalPositiveNumber(assetValue?.height);
    const alt =
      typeof sourceBlock.alt === "string" && sourceBlock.alt.trim().length > 0
        ? sourceBlock.alt.trim()
        : undefined;

    return {
      ...sourceBlock,
      _type: "image",
      _key: typeof sourceBlock._key === "string" ? sourceBlock._key : undefined,
      alt,
      asset:
        imageUrl || imageWidth || imageHeight
          ? {
              ...assetValue,
              url: imageUrl,
              width: imageWidth,
              height: imageHeight,
            }
          : undefined,
    };
  }

  const children = Array.isArray(sourceBlock.children)
    ? sourceBlock.children
        .filter(
          (child): child is Record<string, unknown> =>
            !!child && typeof child === "object" && !Array.isArray(child)
        )
        .filter(
          (child) => child._type === "span" && typeof child.text === "string"
        )
        .map((child) => ({
          ...child,
          _type: "span" as const,
          text: String(child.text),
          marks: Array.isArray(child.marks)
            ? child.marks.filter(
                (mark): mark is string => typeof mark === "string"
              )
            : undefined,
        }))
    : undefined;

  const markDefs = Array.isArray(sourceBlock.markDefs)
    ? sourceBlock.markDefs.filter(
        (markDef): markDef is Record<string, unknown> =>
          !!markDef && typeof markDef === "object" && !Array.isArray(markDef)
      )
    : undefined;

  return {
    ...sourceBlock,
    _type: blockType,
    _key: typeof sourceBlock._key === "string" ? sourceBlock._key : undefined,
    children,
    markDefs,
  } as ContentPortableTextBlock;
}

/** Normalizes a Sanity Portable Text body array into the gateway detail contract body payload. */
function normalizePortableTextBody(
  rawBody: unknown
): GatewayArticleDetail["body"] {
  if (!Array.isArray(rawBody)) {
    return [];
  }

  return rawBody
    .map(normalizePortableTextBlock)
    .filter(
      (
        block
      ): block is ContentPortableTextBlock | ContentPortableTextImageBlock =>
        block !== null
    );
}

/** Maps a Sanity article detail document into the gateway article detail contract. */
function mapSanityArticleDetail(
  payload: SanityArticleDetailPayload
): GatewayArticleDetail | null {
  const article = mapSanityArticle(payload);

  if (!article) {
    return null;
  }

  return {
    ...article,
    seoTitle: toOptionalNonEmptyString(payload.seoTitle),
    seoDescription: toOptionalNonEmptyString(payload.seoDescription),
    seoCanonicalPath: toOptionalNonEmptyString(payload.seoCanonicalPath),
    seoNoIndex: toOptionalBoolean(payload.seoNoIndex),
    seoNoFollow: toOptionalBoolean(payload.seoNoFollow),
    seoOgTitle: toOptionalNonEmptyString(payload.seoOgTitle),
    seoOgDescription: toOptionalNonEmptyString(payload.seoOgDescription),
    seoOgImageUrl: toOptionalNonEmptyString(payload.seoOgImageUrl),
    seoOgImageWidth: toOptionalPositiveNumber(payload.seoOgImageWidth),
    seoOgImageHeight: toOptionalPositiveNumber(payload.seoOgImageHeight),
    seoOgImageAlt: toOptionalNonEmptyString(payload.seoOgImageAlt),
    seoTwitterCard: toOptionalTwitterCard(payload.seoTwitterCard),
    imageAlt: toOptionalNonEmptyString(payload.imageAlt),
    body: normalizePortableTextBody(payload.body),
  };
}

/** Maps a Sanity standalone page summary document into the gateway page contract. */
function mapSanityPage(payload: SanityPagePayload): GatewayPage | null {
  const title = payload.title?.trim();
  const slug = payload.slug?.trim();

  if (!title || !slug) {
    return null;
  }

  return {
    id: payload._id,
    slug,
    title,
    subheading: payload.subheading?.trim() || undefined,
    intro: payload.intro?.trim() || undefined,
    updatedAt: payload.updatedAt?.trim() || undefined,
    hideFromSitemap: toOptionalBoolean(payload.hideFromSitemap),
    seoNoIndex: toOptionalBoolean(payload.seoNoIndex),
  };
}

/** Maps a Sanity standalone page detail document into the gateway page detail contract. */
function mapSanityPageDetail(
  payload: SanityPageDetailPayload
): GatewayPageDetail | null {
  const page = mapSanityPage(payload);

  if (!page) {
    return null;
  }

  return {
    ...page,
    seoTitle: toOptionalNonEmptyString(payload.seoTitle),
    seoDescription: toOptionalNonEmptyString(payload.seoDescription),
    seoCanonicalPath: toOptionalNonEmptyString(payload.seoCanonicalPath),
    seoNoIndex: toOptionalBoolean(payload.seoNoIndex),
    seoNoFollow: toOptionalBoolean(payload.seoNoFollow),
    seoOgTitle: toOptionalNonEmptyString(payload.seoOgTitle),
    seoOgDescription: toOptionalNonEmptyString(payload.seoOgDescription),
    seoOgImageUrl: toOptionalNonEmptyString(payload.seoOgImageUrl),
    seoOgImageWidth: toOptionalPositiveNumber(payload.seoOgImageWidth),
    seoOgImageHeight: toOptionalPositiveNumber(payload.seoOgImageHeight),
    seoOgImageAlt: toOptionalNonEmptyString(payload.seoOgImageAlt),
    seoTwitterCard: toOptionalTwitterCard(payload.seoTwitterCard),
    body: normalizePortableTextBody(payload.body),
  };
}

/** Detects abort-controller timeout errors from the Sanity fetch pipeline. */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Determines whether an upstream status code should be retried. */
function isRetryableStatus(statusCode: number): boolean {
  return RETRYABLE_STATUS_CODES.has(statusCode);
}

/** Waits between retry attempts using linear backoff. */
function sleep(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

/** Creates an abort signal that automatically cancels after the configured timeout. */
function createTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timeoutHandle);
    },
  };
}

/** Fetches a Sanity query URL with timeout and retry behavior for transient upstream failures. */
async function fetchSanityApiResponse(
  queryUrl: string,
  options: CreateSanityContentProviderOptions,
  logger: ILogger,
  resourceLabel: "articles" | "pages" = "articles"
): Promise<Response> {
  const requestTimeoutMs =
    options.requestTimeoutMs ?? DEFAULT_SANITY_REQUEST_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_SANITY_REQUEST_MAX_RETRIES;
  const retryDelayMs =
    options.retryDelayMs ?? DEFAULT_SANITY_REQUEST_RETRY_DELAY_MS;
  const maxAttempts = Math.max(1, maxRetries + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { signal, cancel } = createTimeoutSignal(requestTimeoutMs);
    let response: Response;

    try {
      response = await fetch(queryUrl, {
        method: "GET",
        headers: {
          ...(options.readToken
            ? {
                Authorization: `Bearer ${options.readToken}`,
              }
            : {}),
        },
        cache: "no-store",
        signal,
      });
    } catch (error) {
      cancel();

      const shouldRetry = attempt < maxAttempts;
      const isTimeout = isAbortError(error);

      if (shouldRetry) {
        logger.warn("Retrying Sanity content request after transport error", {
          component: "api.providers.content.sanity",
          metadata: {
            attempt,
            maxAttempts,
            requestTimeoutMs,
            reason: isTimeout ? "timeout" : "network",
            resource: resourceLabel,
          },
        });

        await sleep(retryDelayMs * attempt);
        continue;
      }

      throw new GatewayError({
        statusCode: isTimeout ? 504 : 502,
        code: isTimeout
          ? API_ERROR_CODES.SANITY_UPSTREAM_TIMEOUT
          : API_ERROR_CODES.SANITY_UPSTREAM_NETWORK_ERROR,
        message: isTimeout
          ? getSanityTimeoutMessage(resourceLabel)
          : getSanityNetworkFailureMessage(resourceLabel),
      });
    }

    cancel();

    if (response.ok) {
      return response;
    }

    const shouldRetryStatus =
      attempt < maxAttempts && isRetryableStatus(response.status);

    if (shouldRetryStatus) {
      logger.warn(
        "Retrying Sanity content request after upstream response error",
        {
          component: "api.providers.content.sanity",
          metadata: {
            attempt,
            maxAttempts,
            status: response.status,
            resource: resourceLabel,
          },
        }
      );

      await sleep(retryDelayMs * attempt);
      continue;
    }

    throw new GatewayError({
      statusCode: 502,
      code: API_ERROR_CODES.SANITY_UPSTREAM_ERROR,
      message: getSanityUpstreamFailureMessage(resourceLabel),
      details: {
        status: response.status,
      },
    });
  }

  throw new GatewayError({
    statusCode: 502,
    code: API_ERROR_CODES.SANITY_UPSTREAM_ERROR,
    message: getSanityUpstreamFailureMessage(resourceLabel),
  });
}

/** Parses a Sanity query response payload and normalizes invalid JSON into gateway errors. */
async function parseSanityQueryPayload<T>(
  response: Response
): Promise<SanityQueryResponse<T>> {
  try {
    return (await response.json()) as SanityQueryResponse<T>;
  } catch {
    throw new GatewayError({
      statusCode: 502,
      code: API_ERROR_CODES.SANITY_INVALID_RESPONSE,
      message: API_ERROR_MESSAGES.SANITY_INVALID_RESPONSE,
    });
  }
}

/** Fetches and normalizes article summaries from Sanity. */
async function fetchSanityArticles(
  options: CreateSanityContentProviderOptions,
  logger: ILogger
): Promise<GatewayArticle[]> {
  const queryUrl = createSanityQueryUrl(options, SANITY_ARTICLES_GROQ);
  const response = await fetchSanityApiResponse(
    queryUrl,
    options,
    logger,
    "articles"
  );
  const payload =
    await parseSanityQueryPayload<SanityArticlePayload[]>(response);
  const documents = payload.result ?? [];

  logger.debug("Fetched articles from Sanity provider", {
    count: documents.length,
  });

  return documents
    .map(mapSanityArticle)
    .filter((article): article is GatewayArticle => article !== null);
}

/** Fetches and normalizes a single article detail document from Sanity by slug. */
async function fetchSanityArticleBySlug(
  slug: string,
  options: CreateSanityContentProviderOptions,
  logger: ILogger
): Promise<GatewayArticleDetail | null> {
  const queryUrl = createSanityQueryUrl(options, SANITY_ARTICLE_BY_SLUG_GROQ, {
    slug,
  });
  const response = await fetchSanityApiResponse(
    queryUrl,
    options,
    logger,
    "articles"
  );
  const payload =
    await parseSanityQueryPayload<SanityArticleDetailPayload | null>(response);
  const document = payload.result ?? null;

  if (!document) {
    logger.debug("Sanity article detail not found", {
      slug,
    });
    return null;
  }

  const article = mapSanityArticleDetail(document);

  logger.debug("Fetched article detail from Sanity provider", {
    slug,
    found: article !== null,
  });

  return article;
}

/** Fetches and normalizes standalone page summaries from Sanity. */
async function fetchSanityPages(
  options: CreateSanityContentProviderOptions,
  logger: ILogger
): Promise<GatewayPage[]> {
  const queryUrl = createSanityQueryUrl(options, SANITY_PAGES_GROQ);
  const response = await fetchSanityApiResponse(
    queryUrl,
    options,
    logger,
    "pages"
  );
  const payload = await parseSanityQueryPayload<SanityPagePayload[]>(response);
  const documents = payload.result ?? [];

  logger.debug("Fetched pages from Sanity provider", {
    count: documents.length,
  });

  return documents
    .map(mapSanityPage)
    .filter((page): page is GatewayPage => page !== null);
}

/** Fetches and normalizes a single standalone page document from Sanity by slug. */
async function fetchSanityPageBySlug(
  slug: string,
  options: CreateSanityContentProviderOptions,
  logger: ILogger
): Promise<GatewayPageDetail | null> {
  const queryUrl = createSanityQueryUrl(options, SANITY_PAGE_BY_SLUG_GROQ, {
    slug,
  });
  const response = await fetchSanityApiResponse(
    queryUrl,
    options,
    logger,
    "pages"
  );
  const payload = await parseSanityQueryPayload<SanityPageDetailPayload | null>(
    response
  );
  const document = payload.result ?? null;

  if (!document) {
    logger.debug("Sanity page detail not found", {
      slug,
    });
    return null;
  }

  const page = mapSanityPageDetail(document);

  logger.debug("Fetched page detail from Sanity provider", {
    slug,
    found: page !== null,
  });

  return page;
}

/** Creates a content provider that retrieves article and page data from Sanity. */
export function createSanityContentProvider(
  options: CreateSanityContentProviderOptions,
  logger: ILogger
): ContentProvider {
  return {
    name: "sanity",
    async getArticles() {
      return fetchSanityArticles(options, logger);
    },
    async getArticleBySlug(slug: string) {
      return fetchSanityArticleBySlug(slug, options, logger);
    },
    async getPages() {
      return fetchSanityPages(options, logger);
    },
    async getPageBySlug(slug: string) {
      return fetchSanityPageBySlug(slug, options, logger);
    },
  };
}
