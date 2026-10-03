/**
 * Core exporter: fetch Discogs marketplace listings and yield results.
 *
 * A single user "search" fans out into one HTTP request per result page. All of
 * those requests flow through a shared RateLimiter so the whole server process
 * stays within Discogs' documented budget (25 req / 60s unauthenticated), no
 * matter how many searches run. See rateLimiter.ts for the guarantee.
 */

import { DiscogsMarketplace, SearchParams } from 'discogs-marketplace-api-nodejs';
import { parsePriceField, extractYear, computeDecade } from '../priceUtils';
import { SearchOptions, ListingData, ProgressUpdate, EstimateResult } from './types';
import { RateLimiter } from './rateLimiter';
import { resolveSellerCountry } from './countryFilter';

/** Discogs' hard cap on reachable pages. */
const MAX_PAGES = 400;
const PER_PAGE = 250;

/**
 * Process-wide limiter shared by every search AND every estimate probe, so the
 * combined request rate — not each search individually — respects the budget.
 * 25 req/60s documented, used at 80% (=> 20 req/60s, one every ~3s).
 */
export const discogsLimiter = new RateLimiter({
  maxRequests: 25,
  windowMs: 60_000,
  safetyFactor: 0.8,
});

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Translate our SearchOptions into the library's SearchParams for a given page.
 */
function buildSearchParams(options: SearchOptions, page: number): SearchParams {
  const {
    styles, genre, format, fromCountry, artist, seller,
    minYear, maxYear, currency, condition, formatDescription, sort,
    labelId, masterId, releaseId, artistId,
  } = options;

  const searchParams: SearchParams = {
    api: 'legacy' as const,
    limit: PER_PAGE,
    sort: (sort as any) || 'listed,desc',
    page,
  };

  if (styles && styles.length > 0) searchParams.styles = styles as any;
  if (genre) searchParams.genre = genre as any;
  if (format) searchParams.formats = [format as any];
  if (fromCountry) {
    // The library needs an exact ISO code and silently drops an unrecognised
    // value (returning every country). Resolve the name/code up front and fail
    // loudly instead, so a typo never masquerades as "no filter". See
    // countryFilter.ts for the full rationale.
    const code = resolveSellerCountry(fromCountry);
    if (!code) {
      throw new Error(
        `Unknown seller country "${fromCountry}". Use a country name ` +
        `(e.g. "United States") or its ISO code (e.g. "US").`
      );
    }
    searchParams.from = code as any;
  }
  if (currency) searchParams.currency = currency as any;
  if (artist) searchParams.query = artist;
  if (seller) (searchParams as any).seller = seller;
  if (condition) searchParams.condition = condition as any;
  if (formatDescription) searchParams.formatDescriptions = [formatDescription as any];
  if (minYear !== undefined || maxYear !== undefined) {
    searchParams.years = {} as any;
    if (minYear !== undefined) (searchParams.years as any).min = minYear;
    if (maxYear !== undefined) (searchParams.years as any).max = maxYear;
  }

  // Mutually-exclusive "by ID" lookups: apply the first one provided only.
  if (releaseId !== undefined) (searchParams as any).releaseId = releaseId;
  else if (masterId !== undefined) (searchParams as any).masterId = masterId;
  else if (labelId !== undefined) (searchParams as any).labelId = labelId;
  else if (artistId !== undefined) (searchParams as any).artistId = artistId;

  return searchParams;
}

/**
 * Map one raw library item to our flat ListingData shape.
 */
function mapItemToListing(item: any): ListingData {
  const basePrice = parsePriceField(item.price?.base);
  const shippingPrice = parsePriceField(item.price?.shipping);

  const price = basePrice.value;
  const shipping = shippingPrice.value;
  const total = (price !== null && shipping !== null) ? price + shipping : null;
  const currencyCode = basePrice.currency || shippingPrice.currency || '';

  const year = extractYear(item.description);
  const decade = computeDecade(year);

  const artists = item.artists.map((a: any) => a.name).join('; ');
  const formats = item.formats.join('; ');
  const labels = item.labels.map((l: any) => l.name).join('; ');
  const catalogNumbers = item.catnos.join('; ');

  return {
    id: item.id,
    title: item.title,
    artists,
    formats,
    price,
    shipping,
    total,
    currency: currencyCode,
    have: item.community?.have || 0,
    want: item.community?.want || 0,
    seller_name: item.seller?.name || '',
    seller_url: item.seller?.url || '',
    seller_score: item.seller?.score ? parseFloat(item.seller.score as any) : null,
    seller_country_name: item.country?.name || '',
    seller_country_code: item.country?.code || '',
    year,
    decade,
    condition_media: item.condition?.media?.short || '',
    condition_sleeve: item.condition?.sleeve?.short || null,
    labels,
    catalog_numbers: catalogNumbers,
    description: item.description,
    listed_at: item.listedAt?.toISOString() || null,
    listing_url: item.url,
    release_id: item.release?.id || 0,
    release_url: item.release?.url || '',
    image_url: item.imageUrl,
  };
}

/**
 * Cheap "probe": fetch only page 1 to learn the exact totals, then compute how
 * much a full fetch would cost under the shared rate limiter. The page-1 items
 * are returned too, so the probe request is reused rather than wasted.
 */
export async function estimateSearch(options: SearchOptions): Promise<EstimateResult> {
  const searchParams = buildSearchParams(options, 1);
  console.log('[ESTIMATE] Probing page 1 with params:', JSON.stringify(searchParams));

  await discogsLimiter.acquire();
  const result: any = await retryWithBackoff(
    () => DiscogsMarketplace.search(searchParams),
    3,
    2000
  );

  const totalItems: number = result.result?.total ?? 0;
  const perPage: number = result.result?.perPage || PER_PAGE;
  const totalPages: number = result.page?.total ?? 0;
  const cappedPages = Math.min(totalPages, MAX_PAGES);
  const fetchableItems = Math.min(totalItems, cappedPages * perPage);
  const firstPageItems: ListingData[] = (result.items || []).map(mapItemToListing);

  return {
    totalItems,
    perPage,
    totalPages,
    cappedPages,
    fetchableItems,
    requestsForAll: cappedPages,
    // Page 1 is already fetched, so a full fetch needs cappedPages requests
    // total; the limiter spaces them (cappedPages - 1 gaps).
    estimatedTimeMsAll: discogsLimiter.estimateDurationMs(cappedPages),
    rateDescription: discogsLimiter.describe(),
    firstPageItems,
  };
}

/**
 * Generator function that yields listings as they are fetched
 */
export async function* searchListings(
  options: SearchOptions,
  onProgress?: (progress: ProgressUpdate) => void
): AsyncGenerator<ListingData, void, unknown> {
  let currentPage = 1;
  let maxPages = MAX_PAGES;
  let totalItemsYielded = 0;

  // Optional hard cap on results: translate an item count into a page count.
  const itemCap = options.maxItems && options.maxItems > 0 ? options.maxItems : Infinity;
  const pageCap = itemCap === Infinity
    ? MAX_PAGES
    : Math.min(MAX_PAGES, Math.ceil(itemCap / PER_PAGE));

  console.log('[SEARCH] Search params:', JSON.stringify(buildSearchParams(options, 1), null, 2));
  if (itemCap !== Infinity) {
    console.log(`[SEARCH] Capped to ${itemCap} items (${pageCap} pages max)`);
  }

  while (currentPage <= maxPages && currentPage <= pageCap) {
    const searchParams = buildSearchParams(options, currentPage);

    try {
      // Wait for a compliant slot BEFORE each request (the guarantee).
      await discogsLimiter.acquire();

      const result: any = await retryWithBackoff(
        () => DiscogsMarketplace.search(searchParams),
        3,
        2000
      );

      // Update max pages from response
      if (result.page && result.page.total) {
        maxPages = Math.min(result.page.total, MAX_PAGES);
      }

      // Check if we have items
      if (!result.items || result.items.length === 0) {
        break;
      }

      // Process each item, stopping at the cap if set.
      for (const item of result.items) {
        yield mapItemToListing(item);
        totalItemsYielded++;
        if (totalItemsYielded >= itemCap) break;
      }

      const effectiveMaxPages = Math.min(maxPages, pageCap);

      // Report progress
      if (onProgress) {
        onProgress({
          currentPage,
          totalPages: effectiveMaxPages,
          itemsLoaded: totalItemsYielded,
          isComplete: currentPage >= effectiveMaxPages || totalItemsYielded >= itemCap,
        });
      }

      // Stop if we've hit the cap or the last page.
      if (totalItemsYielded >= itemCap) break;
      if (currentPage >= maxPages) break;

      // Move to next page (spacing handled by the limiter on next acquire()).
      currentPage++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle rate limiting (403/429)
      if (errorMessage.includes('403') || errorMessage.includes('429')) {
        console.warn(`[RATE LIMIT] Encountered ${errorMessage.includes('403') ? '403' : '429'} on page ${currentPage}`);

        if (onProgress) {
          onProgress({
            currentPage,
            totalPages: maxPages,
            itemsLoaded: totalItemsYielded,
            isComplete: false,
            rateLimited: true,
          });
        }

        // Break and return what we have
        break;
      }

      // For other errors, if we have some results (page > 1), log and break
      if (currentPage > 1) {
        console.error(`Error fetching page ${currentPage}:`, error);
        break;
      }

      // On page 1, throw because we have no results yet
      console.error(`Error fetching page ${currentPage}:`, error);
      throw error;
    }
  }

  // Final progress update
  if (onProgress) {
    const finalPages = Math.min(maxPages, pageCap);
    onProgress({
      currentPage: finalPages,
      totalPages: finalPages,
      itemsLoaded: totalItemsYielded,
      isComplete: true,
    });
  }
}
