/**
 * Shared type definitions for the web UI
 */

export interface SearchOptions {
  styles?: string[];
  genre?: string;
  format?: string;
  fromCountry?: string;
  artist?: string;
  seller?: string;
  minYear?: number;
  maxYear?: number;
  currency?: string;
  condition?: string;
  formatDescription?: string;
  sort?: string;
  pageDelayMs?: number;
  /** Cap on how many listings to fetch. Omit to fetch all (up to Discogs' limit). */
  maxItems?: number;
  /** Power-user "by ID" lookups. Mutually exclusive; first provided wins. */
  labelId?: number;
  masterId?: number;
  releaseId?: number;
  artistId?: number;
}

/** Response from POST /api/estimate — the cost preview for a search. */
export interface EstimateResult {
  totalItems: number;
  perPage: number;
  totalPages: number;
  cappedPages: number;
  fetchableItems: number;
  requestsForAll: number;
  estimatedTimeMsAll: number;
  rateDescription: string;
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
  description: string;
  listed_at: string | null;
  listing_url: string;
  release_id: number;
  release_url: string;
  image_url: string;
}

export interface ProgressUpdate {
  currentPage: number;
  totalPages: number;
  itemsLoaded: number;
  isComplete: boolean;
}
