/**
 * Shared types for the exporter
 */

export interface SearchOptions {
  styles?: string[];
  genre?: string;
  format?: string;
  fromCountry?: string;
  artist?: string;
  /** Filter to a specific seller by their Discogs username (resolved to an ID). */
  seller?: string;
  minYear?: number;
  maxYear?: number;
  currency?: string;
  condition?: string;
  formatDescription?: string;
  sort?: string;
  pageDelayMs?: number;
  /**
   * Optional cap on how many listings to fetch. When set, the search stops once
   * this many items have been yielded (rounded up to a whole page). Omit for all.
   */
  maxItems?: number;
  /**
   * Power-user "by ID" lookups (Discogs numeric IDs). Only the first provided
   * (in the order release, master, label, artist) is applied.
   */
  labelId?: number;
  masterId?: number;
  releaseId?: number;
  artistId?: number;
}

/**
 * Result of a cheap "probe" (single page-1 request) used to preview the cost of
 * a full search before committing to it. `totalItems` is exact, reported by
 * Discogs; the page counts derive from it, and `estimatedTimeMsAll` from the
 * rate limiter's spacing.
 */
export interface EstimateResult {
  /** Exact total listings matching the filters (Discogs `total`). */
  totalItems: number;
  /** Results per page (250). */
  perPage: number;
  /** Total pages needed for every listing (totalItems / perPage, rounded up). */
  totalPages: number;
  /** Pages we would actually fetch, capped at our 400-page safety limit. */
  cappedPages: number;
  /** Listings we would actually fetch given the cap (cappedPages * perPage, clamped). */
  fetchableItems: number;
  /** Requests needed to fetch `fetchableItems` (one per page). */
  requestsForAll: number;
  /** Estimated wall-clock ms to fetch all fetchable pages at the safe rate. */
  estimatedTimeMsAll: number;
  /** The safe budget in effect, for display (e.g. "20 req / 60000ms"). */
  rateDescription: string;
  /** The first page of items (250), so the probe request is not wasted. */
  firstPageItems: ListingData[];
}

export interface ListingData {
  id: number;
  title: string;
  artists: string;
  formats: string;
  price: number | null;
  shipping: number | null;
  total: number | null;
  currency: string;
  have: number;
  want: number;
  seller_name: string;
  seller_url: string;
  seller_score: number | null;
  seller_country_name: string;
  seller_country_code: string;
  year: number | null;
  decade: string | null;
  condition_media: string;
  condition_sleeve: string | null;
  labels: string;
  catalog_numbers: string;
  description: string | null;
  listed_at: string | null;
  listing_url: string;
  release_id: number;
  release_url: string;
  image_url: string | null;
}

export interface ProgressUpdate {
  currentPage: number;
  totalPages: number;
  itemsLoaded: number;
  isComplete: boolean;
  rateLimited?: boolean;
  /** The search stopped early because Discogs blocked a request (HTTP 403). */
  blocked?: boolean;
}
