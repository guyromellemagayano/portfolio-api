/**
 * @file apps/api/src/providers/content/__tests__/sanity-content.provider.test.ts
 * @author Guy Romelle Magayano
 * @description Unit tests for Sanity content provider timeout and retry behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ERROR_CODES } from "@portfolio/api-contracts/http";

import { createApiLogger } from "@api/config/logger";
import { createSanityContentProvider } from "@api/providers/content/sanity-content.provider";

describe("sanity content provider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries once for retryable upstream responses and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          result: [
            {
              _id: "article-1",
              title: "Article 1",
              slug: "article-1",
              publishedAt: "2026-02-24",
              excerpt: "Summary",
              hideFromSitemap: false,
              seoNoIndex: false,
              imageUrl: "https://cdn.example.com/image.jpg",
              imageWidth: 1200,
              imageHeight: 800,
              tags: ["engineering"],
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const provider = createSanityContentProvider(
      {
        projectId: "demo-project",
        dataset: "production",
        apiVersion: "2025-02-19",
        useCdn: true,
        maxRetries: 1,
        retryDelayMs: 0,
      },
      createApiLogger("test")
    );

    await expect(provider.getArticles()).resolves.toEqual([
      {
        id: "article-1",
        title: "Article 1",
        slug: "article-1",
        publishedAt: "2026-02-24",
        excerpt: "Summary",
        hideFromSitemap: false,
        seoNoIndex: false,
        imageUrl: "https://cdn.example.com/image.jpg",
        imageWidth: 1200,
        imageHeight: 800,
        tags: ["engineering"],
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a timeout gateway error after exhausting retries", async () => {
    const timeoutError = new Error("The operation was aborted.");
    timeoutError.name = "AbortError";

    const fetchMock = vi.fn().mockRejectedValue(timeoutError);
    vi.stubGlobal("fetch", fetchMock);

    const provider = createSanityContentProvider(
      {
        projectId: "demo-project",
        dataset: "production",
        apiVersion: "2025-02-19",
        useCdn: true,
        maxRetries: 1,
        retryDelayMs: 0,
        requestTimeoutMs: 5,
      },
      createApiLogger("test")
    );

    await expect(provider.getArticles()).rejects.toMatchObject({
      code: API_ERROR_CODES.SANITY_UPSTREAM_TIMEOUT,
      statusCode: 504,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a normalized article detail payload by slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        result: {
          _id: "article-1",
          title: "Article 1",
          slug: "article-1",
          publishedAt: "2026-02-24T00:00:00.000Z",
          excerpt: "Summary",
          hideFromSitemap: false,
          seoTitle: "Article 1 | SEO",
          seoDescription: "SEO Summary",
          seoCanonicalPath: "/articles/article-1",
          seoNoIndex: false,
          seoNoFollow: true,
          seoOgTitle: "Article 1 OG",
          seoOgDescription: "OG Summary",
          seoOgImageUrl: "https://cdn.example.com/og-cover.jpg",
          seoOgImageWidth: 1200,
          seoOgImageHeight: 630,
          seoOgImageAlt: "OG cover alt text",
          seoTwitterCard: "summary_large_image",
          imageUrl: "https://cdn.example.com/cover.jpg",
          imageWidth: 1600,
          imageHeight: 900,
          imageAlt: "Cover alt text",
          tags: ["engineering", " "],
          body: [
            {
              _key: "block-1",
              _type: "block",
              style: "normal",
              children: [
                {
                  _key: "span-1",
                  _type: "span",
                  text: "Hello world",
                  marks: ["strong"],
                },
                {
                  _key: "invalid-span",
                  _type: "span",
                  text: 42,
                },
              ],
              markDefs: [],
            },
            {
              _key: "image-1",
              _type: "image",
              alt: "Inline image",
              asset: {
                url: "https://cdn.example.com/inline.jpg",
                width: 1024,
                height: 768,
              },
            },
            {
              _key: "invalid-block",
              style: "normal",
            },
          ],
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const provider = createSanityContentProvider(
      {
        projectId: "demo-project",
        dataset: "production",
        apiVersion: "2025-02-19",
        useCdn: true,
      },
      createApiLogger("test")
    );

    await expect(provider.getArticleBySlug("article-1")).resolves.toEqual({
      id: "article-1",
      title: "Article 1",
      slug: "article-1",
      publishedAt: "2026-02-24T00:00:00.000Z",
      excerpt: "Summary",
      hideFromSitemap: false,
      seoTitle: "Article 1 | SEO",
      seoDescription: "SEO Summary",
      seoCanonicalPath: "/articles/article-1",
      seoNoIndex: false,
      seoNoFollow: true,
      seoOgTitle: "Article 1 OG",
      seoOgDescription: "OG Summary",
      seoOgImageUrl: "https://cdn.example.com/og-cover.jpg",
      seoOgImageWidth: 1200,
      seoOgImageHeight: 630,
      seoOgImageAlt: "OG cover alt text",
      seoTwitterCard: "summary_large_image",
      imageUrl: "https://cdn.example.com/cover.jpg",
      imageWidth: 1600,
      imageHeight: 900,
      imageAlt: "Cover alt text",
      tags: ["engineering"],
      body: [
        {
          _key: "block-1",
          _type: "block",
          style: "normal",
          children: [
            {
              _key: "span-1",
              _type: "span",
              text: "Hello world",
              marks: ["strong"],
            },
          ],
          markDefs: [],
        },
        {
          _key: "image-1",
          _type: "image",
          alt: "Inline image",
          asset: {
            url: "https://cdn.example.com/inline.jpg",
            width: 1024,
            height: 768,
          },
        },
      ],
    });
  });

  it("returns null when no article exists for the requested slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        result: null,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const provider = createSanityContentProvider(
      {
        projectId: "demo-project",
        dataset: "production",
        apiVersion: "2025-02-19",
        useCdn: true,
      },
      createApiLogger("test")
    );

    await expect(
      provider.getArticleBySlug("missing-article")
    ).resolves.toBeNull();
  });

  it("returns normalized standalone page summaries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        result: [
          {
            _id: "page-1",
            title: "Now",
            slug: "now",
            subheading: "Now",
            intro: "Current focus and priorities",
            updatedAt: "2026-02-25T00:00:00.000Z",
            hideFromSitemap: false,
            seoNoIndex: false,
          },
          {
            _id: "invalid-page",
            title: "",
            slug: "invalid",
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const provider = createSanityContentProvider(
      {
        projectId: "demo-project",
        dataset: "production",
        apiVersion: "2025-02-19",
        useCdn: true,
      },
      createApiLogger("test")
    );

    await expect(provider.getPages()).resolves.toEqual([
      {
        id: "page-1",
        slug: "now",
        title: "Now",
        subheading: "Now",
        intro: "Current focus and priorities",
        updatedAt: "2026-02-25T00:00:00.000Z",
        hideFromSitemap: false,
        seoNoIndex: false,
      },
    ]);
  });

  it("returns a normalized standalone page detail payload by slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        result: {
          _id: "page-1",
          title: "Now",
          slug: "now",
          subheading: "Now",
          intro: "Current focus and priorities",
          updatedAt: "2026-02-25T00:00:00.000Z",
          hideFromSitemap: true,
          seoTitle: "Now | SEO",
          seoDescription: "What I am working on now.",
          seoCanonicalPath: "/now",
          seoNoIndex: true,
          seoNoFollow: true,
          seoOgTitle: "Now OG",
          seoOgDescription: "Now OG Description",
          seoOgImageUrl: "https://cdn.example.com/now-og.jpg",
          seoOgImageWidth: 1200,
          seoOgImageHeight: 630,
          seoOgImageAlt: "Now OG image alt",
          seoTwitterCard: "summary",
          body: [
            {
              _key: "block-1",
              _type: "block",
              style: "normal",
              children: [
                {
                  _key: "span-1",
                  _type: "span",
                  text: "Building standalone pages in Sanity.",
                },
              ],
              markDefs: [],
            },
          ],
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const provider = createSanityContentProvider(
      {
        projectId: "demo-project",
        dataset: "production",
        apiVersion: "2025-02-19",
        useCdn: true,
      },
      createApiLogger("test")
    );

    await expect(provider.getPageBySlug("now")).resolves.toEqual({
      id: "page-1",
      slug: "now",
      title: "Now",
      subheading: "Now",
      intro: "Current focus and priorities",
      updatedAt: "2026-02-25T00:00:00.000Z",
      hideFromSitemap: true,
      seoTitle: "Now | SEO",
      seoDescription: "What I am working on now.",
      seoCanonicalPath: "/now",
      seoNoIndex: true,
      seoNoFollow: true,
      seoOgTitle: "Now OG",
      seoOgDescription: "Now OG Description",
      seoOgImageUrl: "https://cdn.example.com/now-og.jpg",
      seoOgImageWidth: 1200,
      seoOgImageHeight: 630,
      seoOgImageAlt: "Now OG image alt",
      seoTwitterCard: "summary",
      body: [
        {
          _key: "block-1",
          _type: "block",
          style: "normal",
          children: [
            {
              _key: "span-1",
              _type: "span",
              text: "Building standalone pages in Sanity.",
            },
          ],
          markDefs: [],
        },
      ],
    });
  });
});
