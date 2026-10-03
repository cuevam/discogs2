/**
 * Core exporter: fetch Discogs marketplace listings and yield results.
 *
 * Searches go through the new Discogs shop API, run by the marketplace library
 * from a shared headless browser (see browser.ts). Results are paginated with a
 * cursor, so a single user "search" fans out into one request per result page.
 * All of those requests flow through a shared RateLimiter so the whole server
 * process keeps a conservative pace, no matter how many searches run. See
 * rateLimiter.ts for the guarantee.
 */

import { DiscogsMarketplace, SearchParams, SearchResult } from 'discogs-marketplace-api-nodejs';
import StyleTableDefault from 'discogs-marketplace-api-nodejs/dist/data/style.data.js';
import { parsePriceField, extractYear, computeDecade } from '../priceUtils';
import { SearchOptions, ListingData, ProgressUpdate, EstimateResult } from './types';
import { RateLimiter } from './rateLimiter';
import { resolveSellerCountry } from './countryFilter';
import { resolveSellerId } from './sellerLookup';
import { getBrowser } from './browser';
import { DiscogsError, classifyError } from './discogsError';

/**
 * Safety cap on pages per search. The shop API has no page limit of its own
 * (tested past 45 pages), but 400 x 250 = 100,000 listings is plenty.
 */
const MAX_PAGES = 400;
const PER_PAGE = 250;
/** Typical time for one 250-item page from the shop API (measured ~2.5s). */
const PAGE_FETCH_MS = 2500;

/** Sort fields the shop API supports. `label` and `catno` are no longer available. */
const SUPPORTED_SORT_FIELDS = new Set([
  'listed', 'condition', 'sleeveCondition', 'artist', 'title', 'year',
  'releaseCountry', 'seller', 'sellerRating', 'sellerRatingCount', 'shipsFrom', 'price',
]);
const DEFAULT_SORT = 'listed,desc';

/** Canonical style names keyed by lower-case name, for case-insensitive validation. */
const StyleTable = StyleTableDefault as unknown as Record<string, string[]>;
const styleByLowerName = new Map(Object.keys(StyleTable).map((name) => [name.toLowerCase(), name]));

type MarketplaceItem = SearchResult['items'][number];

/**
 * Process-wide limiter shared by every search AND every estimate probe, so the
 * combined request rate — not each search individually — stays conservative.
 * 25 req/60s, used at 80% (=> 20 req/60s, one page every ~3s).
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
 * Retry helper with exponential backoff. Only rate limits and network errors
 * are retried: a Cloudflare block or a bad filter won't fix itself.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const discogsError = classifyError(error);
      const retryable = discogsError.kind === 'rateLimited' || discogsError.kind === 'network';
      if (!retryable || attempt >= maxRetries) throw discogsError;

      const delayMs = baseDelayMs * Math.pow(2, attempt);
      console.log(`[RETRY] Attempt ${attempt + 1} failed (${discogsError.kind}), retrying in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }
}

/** One page of results from the shared browser, paced by the limiter. */
async function fetchPage(params: SearchParams): Promise<SearchResult> {
  await discogsLimiter.acquire();
  return retryWithBackoff(async () => DiscogsMarketplace.search(params, await getBrowser()), 3, 2000);
}

/** Map a style name to the library's canonical spelling, or throw if unknown. */
function resolveStyle(input: string): string {
  const name = styleByLowerName.get(input.trim().toLowerCase());
  if (!name) {
    // The library silently drops unknown styles, which would return results
    // for every style. Fail loudly instead.
    throw new DiscogsError('invalidInput', `Unknown style "${input}". Check the spelling against Discogs' style list.`);
  }
  return name;
}

function resolveSort(sort: string | undefined): string {
  if (!sort) return DEFAULT_SORT;
  const [field, direction] = sort.split(',');
  if (SUPPORTED_SORT_FIELDS.has(field) && (direction === 'asc' || direction === 'desc')) return sort;
  console.warn(`[SORT] "${sort}" is not supported by the Discogs shop, using ${DEFAULT_SORT}`);
  return DEFAULT_SORT;
}

/**
 * Translate our SearchOptions into the library's SearchParams (without a cursor).
 */
async function buildSearchParams(options: SearchOptions): Promise<SearchParams> {
  const {
    styles, genre, format, fromCountry, artist, seller,
    minYear, maxYear, currency, condition, formatDescription, sort,
    labelId, masterId, releaseId, artistId,
  } = options;

  const searchParams: SearchParams = {
    limit: PER_PAGE,
    sort: resolveSort(sort),
    // The shop also lists sold and on-hold items by default; we only want
    // listings that can be bought.
    showUnavailable: false,
  };

  const styleNames = (styles ?? []).filter((s) => s.trim());
  if (styleNames.length > 0) {
    searchParams.styles = styleNames.map(resolveStyle);
    if (searchParams.styles.length > 1 && searchParams.styles.some((s) => StyleTable[s].length > 1)) {
      // A style shared by several genres has several IDs; the library then
      // matches ANY of the styles instead of ALL of them.
      console.log('[STYLES] Multi-genre style selected, styles match ANY instead of ALL');
    }
  }
  if (genre) searchParams.genres = [genre];
  if (format) searchParams.formats = [format];
  if (formatDescription) searchParams.formatDescriptions = [formatDescription];
  if (fromCountry) {
    // Resolve the name/code up front and fail loudly, so a typo never
    // masquerades as "no filter". See countryFilter.ts.
    const code = resolveSellerCountry(fromCountry);
    if (!code) {
      throw new DiscogsError(
        'invalidInput',
        `Unknown seller country "${fromCountry}". Use a country name ` +
        `(e.g. "United States") or its ISO code (e.g. "US").`
      );
    }
    searchParams.from = [code];
  }
  if (currency) searchParams.currencies = [currency];
  if (artist) searchParams.query = artist;
  if (seller && seller.trim()) searchParams.sellerIds = [await resolveSellerId(seller)];
  if (condition) searchParams.mediaConditions = [condition];
  if (minYear !== undefined || maxYear !== undefined) {
    // The shop API needs both bounds; fill the missing one with an open end.
    searchParams.years = {
      min: minYear ?? 1900,
      max: maxYear ?? new Date().getFullYear() + 1,
    };
  }

  // "By ID" lookups: the shop API can combine them, but we keep the old
  // behaviour of applying only the first one provided.
  if (releaseId !== undefined) searchParams.releaseIds = [releaseId];
  else if (masterId !== undefined) searchParams.masterIds = [masterId];
  else if (labelId !== undefined) searchParams.labelIds = [labelId];
  else if (artistId !== undefined) searchParams.artistIds = [artistId];

  return searchParams;
}

/**
 * Map one library item to our flat ListingData shape.
 */
function mapItemToListing(item: MarketplaceItem): ListingData {
  const basePrice = parsePriceField(item.price.base);
  const shippingPrice = parsePriceField(item.price.shipping);

  const price = basePrice.value;
  const shipping = shippingPrice.value;
  const total = (price !== null && shipping !== null) ? price + shipping : null;
  const currencyCode = basePrice.currency || shippingPrice.currency || '';

  const year = item.release.year ?? extractYear(item.description);
  const decade = computeDecade(year);

  return {
    id: item.id,
    title: item.title,
    artists: item.artists.map((a) => a.name).join('; '),
    formats: item.formats.join('; '),
    price,
    shipping,
    total,
    currency: currencyCode,
    have: item.community.have,
    want: item.community.want,
    seller_name: item.seller.name,
    seller_url: item.seller.url,
    seller_score: item.seller.score ? parseFloat(item.seller.score) : null,
    seller_country_name: item.country.name,
    seller_country_code: item.country.code ?? '',
    year,
    decade,
    condition_media: item.condition.media.short,
    condition_sleeve: item.condition.sleeve?.short || null,
    labels: item.labels.map((l) => l.name).join('; '),
    catalog_numbers: item.catnos.join('; '),
    description: item.description,
    listed_at: item.listedAt?.toISOString() ?? null,
    listing_url: item.url,
    release_id: item.release.id,
    release_url: item.release.url,
    image_url: item.imageUrl,
  };
}

/**
 * Cheap "probe": fetch only page 1 to learn the exact total, then compute how
 * much a full fetch would cost under the shared rate limiter. The page-1 items
 * are returned too, so the probe request is reused rather than wasted.
 */
export async function estimateSearch(options: SearchOptions): Promise<EstimateResult> {
  const searchParams = await buildSearchParams(options);
  console.log('[ESTIMATE] Probing page 1 with params:', JSON.stringify(searchParams));

  const result = await fetchPage(searchParams);

  const totalItems = result.total;
  const totalPages = Math.ceil(totalItems / PER_PAGE);
  const cappedPages = Math.min(totalPages, MAX_PAGES);
  const fetchableItems = Math.min(totalItems, cappedPages * PER_PAGE);

  return {
    totalItems,
    perPage: PER_PAGE,
    totalPages,
    cappedPages,
    fetchableItems,
    requestsForAll: cappedPages,
    // The limiter spaces page requests (cappedPages - 1 gaps); add the time to
    // fetch the last page itself.
    estimatedTimeMsAll: cappedPages > 0 ? discogsLimiter.estimateDurationMs(cappedPages) + PAGE_FETCH_MS : 0,
    rateDescription: discogsLimiter.describe(),
    firstPageItems: result.items.map(mapItemToListing),
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
  let after: string | undefined;

  // Optional hard cap on results: translate an item count into a page count.
  const itemCap = options.maxItems && options.maxItems > 0 ? options.maxItems : Infinity;
  const pageCap = itemCap === Infinity
    ? MAX_PAGES
    : Math.min(MAX_PAGES, Math.ceil(itemCap / PER_PAGE));

  // Built once: resolving the seller is a network call.
  const baseParams = await buildSearchParams(options);
  console.log('[SEARCH] Search params:', JSON.stringify(baseParams, null, 2));
  if (itemCap !== Infinity) {
    console.log(`[SEARCH] Capped to ${itemCap} items (${pageCap} pages max)`);
  }

  while (currentPage <= maxPages && currentPage <= pageCap) {
    try {
      const result = await fetchPage({ ...baseParams, after });

      // The total is reported on every page; derive the page count from it.
      maxPages = Math.min(Math.ceil(result.total / PER_PAGE), MAX_PAGES);

      if (result.items.length === 0) break;

      // Process each item, stopping at the cap if set.
      for (const item of result.items) {
        yield mapItemToListing(item);
        totalItemsYielded++;
        if (totalItemsYielded >= itemCap) break;
      }

      const effectiveMaxPages = Math.min(maxPages, pageCap);
      const isLastPage = !result.nextCursor || currentPage >= effectiveMaxPages;

      // Report progress
      if (onProgress) {
        onProgress({
          currentPage,
          totalPages: effectiveMaxPages,
          itemsLoaded: totalItemsYielded,
          isComplete: isLastPage || totalItemsYielded >= itemCap,
        });
      }

      // Stop if we've hit the cap or the last page.
      if (totalItemsYielded >= itemCap || isLastPage) break;

      // Move to next page (spacing handled by the limiter on next acquire()).
      after = result.nextCursor ?? undefined;
      currentPage++;
    } catch (error) {
      const discogsError = classifyError(error);

      // On page 1, throw because we have no results yet
      if (currentPage === 1) {
        console.error(`Error fetching page ${currentPage}:`, discogsError.cause ?? discogsError);
        throw discogsError;
      }

      // Later pages: keep what we have and tell the client why we stopped.
      console.warn(`[${discogsError.kind.toUpperCase()}] Stopping at page ${currentPage}: ${discogsError.message}`);
      if (onProgress) {
        onProgress({
          currentPage,
          totalPages: Math.min(maxPages, pageCap),
          itemsLoaded: totalItemsYielded,
          isComplete: false,
          rateLimited: discogsError.kind === 'rateLimited',
          blocked: discogsError.kind === 'blocked',
        });
      }
      break;
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
