/**
 * @file apps/api/src/providers/content/local-content.provider.ts
 * @author Guy Romelle Magayano
 * @description Local typed content provider backed by `@portfolio/content-data` snapshots.
 */

import { contentSnapshot } from "@portfolio/content-data";

import type { ContentProvider } from "./content.provider.js";

/** Creates a local content provider used as the default source of article/page content. */
export function createLocalContentProvider(): ContentProvider {
  return {
    name: "local",
    async getArticles() {
      return contentSnapshot.articleSummaries.map((article) => ({
        ...article,
        tags: [...article.tags],
      }));
    },
    async getArticleBySlug(slug: string) {
      const normalizedSlug = slug.trim();

      if (!normalizedSlug) {
        return null;
      }

      const article = contentSnapshot.articleBySlug.get(normalizedSlug);

      if (!article) {
        return null;
      }

      return {
        ...article,
        tags: [...article.tags],
        body: [...article.body],
      };
    },
    async getPages() {
      return contentSnapshot.pageSummaries.map((page) => ({
        ...page,
      }));
    },
    async getPageBySlug(slug: string) {
      const normalizedSlug = slug.trim();

      if (!normalizedSlug) {
        return null;
      }

      const page = contentSnapshot.pageBySlug.get(normalizedSlug);

      if (!page) {
        return null;
      }

      return {
        ...page,
        body: [...page.body],
      };
    },
  };
}
