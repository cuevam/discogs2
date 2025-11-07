/**
 * Shared types for the exporter
 */

export interface SearchOptions {
  styles?: string[];
  genre?: string;
  format?: string;
  fromCountry?: string;
  artist?: string;
  minYear?: number;
  maxYear?: number;
  currency?: string;
  condition?: string;
  formatDescription?: string;
  sort?: string;
  pageDelayMs?: number;
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
}
