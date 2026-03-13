/**
 * @file apps/api/src/modules/content/content.service.ts
 * @author Guy Romelle Magayano
 * @description Content service orchestrating provider-level article retrieval.
 */

import type {
  GatewayArticle,
  GatewayArticleDetail,
} from "../../contracts/articles.js";
import type { GatewayPage, GatewayPageDetail } from "../../contracts/pages.js";
import type { ContentProvider } from "../../providers/content/content.provider.js";

export type ContentService = {
  providerName: ContentProvider["name"];
  getArticles: () => Promise<GatewayArticle[]>;
  getArticleBySlug: (slug: string) => Promise<GatewayArticleDetail | null>;
  getPages: () => Promise<GatewayPage[]>;
  getPageBySlug: (slug: string) => Promise<GatewayPageDetail | null>;
};

/** Creates content service bound to a specific provider implementation. */
export function createContentService(
  contentProvider: ContentProvider
): ContentService {
  return {
    providerName: contentProvider.name,
    getArticles: () => contentProvider.getArticles(),
    getArticleBySlug: (slug: string) => contentProvider.getArticleBySlug(slug),
    getPages: () => contentProvider.getPages(),
    getPageBySlug: (slug: string) => contentProvider.getPageBySlug(slug),
  };
}
