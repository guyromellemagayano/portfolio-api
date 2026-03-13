/**
 * @file apps/api/src/contracts/pages.ts
 * @author Guy Romelle Magayano
 * @description Gateway contract for normalized standalone page payloads.
 */

import type {
  ContentPage,
  ContentPageDetail,
} from "@portfolio/api-contracts/content";

/** Local alias used by API modules for canonical content page contracts. */
export type GatewayPage = ContentPage;

/** Local alias used by API modules for canonical page detail contracts. */
export type GatewayPageDetail = ContentPageDetail;
