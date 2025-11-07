/**
 * Core exporter: fetch Discogs marketplace listings and yield results
 */

import { DiscogsMarketplace, SearchParams } from 'discogs-marketplace-api-nodejs';
import { parsePriceField, extractYear, computeDecade } from '../priceUtils';
import { SearchOptions, ListingData, ProgressUpdate } from './types';

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generator function that yields listings as they are fetched
 */
export async function* searchListings(
  options: SearchOptions,
  onProgress?: (progress: ProgressUpdate) => void
): AsyncGenerator<ListingData, void, unknown> {
  const {
    styles,
    genre,
    format,
    fromCountry,
    artist,
    minYear,
    maxYear,
    currency,
    condition,
    formatDescription,
    sort,
    pageDelayMs = 1000
  } = options;

  // Build search params
  const searchParams: SearchParams = {
    api: 'legacy' as const,
    limit: 250,
    sort: (sort as any) || 'listed,desc',
    page: 1
  };

  if (styles && styles.length > 0) {
    searchParams.styles = styles as any;
  }
  if (genre) {
    searchParams.genre = genre as any;
  }
  if (format) {
    searchParams.formats = [format as any];
  }
  if (fromCountry) {
    searchParams.from = fromCountry as any;
    // Also set ships_from directly in case the library doesn't translate it
    (searchParams as any).ships_from = fromCountry;
  }
  if (currency) {
    searchParams.currency = currency as any;
  }
  if (artist) {
    searchParams.query = artist;
  }
  if (condition) {
    searchParams.condition = condition as any;
  }
  if (formatDescription) {
    searchParams.formatDescriptions = [formatDescription as any];
  }
  if (minYear !== undefined || maxYear !== undefined) {
    searchParams.years = {} as any;
    if (minYear !== undefined) (searchParams.years as any).min = minYear;
    if (maxYear !== undefined) (searchParams.years as any).max = maxYear;
  }

  let currentPage = 1;
  let maxPages = 400; // Discogs limit
  let totalItemsYielded = 0;

  // Debug: log the search params on first page
  console.log('[SEARCH] Search params:', JSON.stringify(searchParams, null, 2));

  while (currentPage <= maxPages) {
    searchParams.page = currentPage;

    try {
      const result = await DiscogsMarketplace.search(searchParams);

      // Update max pages from response
      if (result.page && result.page.total) {
        maxPages = Math.min(result.page.total, 400);
      }

      // Check if we have items
      if (!result.items || result.items.length === 0) {
        break;
      }

      // Process each item
      for (const item of result.items) {
        // Parse prices
        const basePrice = parsePriceField(item.price?.base);
        const shippingPrice = parsePriceField(item.price?.shipping);

        const price = basePrice.value;
        const shipping = shippingPrice.value;
        const total = (price !== null && shipping !== null) ? price + shipping : null;
        const currencyCode = basePrice.currency || shippingPrice.currency || '';

        // Extract year and decade
        const year = extractYear(item.description);
        const decade = computeDecade(year);

        // Join arrays to strings
        const artists = item.artists.map(a => a.name).join('; ');
        const formats = item.formats.join('; ');
        const labels = item.labels.map(l => l.name).join('; ');
        const catalogNumbers = item.catnos.join('; ');

        // Yield the listing data
        const listing: ListingData = {
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
          image_url: item.imageUrl
        };

        yield listing;
        totalItemsYielded++;
      }

      // Report progress
      if (onProgress) {
        onProgress({
          currentPage,
          totalPages: maxPages,
          itemsLoaded: totalItemsYielded,
          isComplete: currentPage >= maxPages
        });
      }

      // Check if we've reached the last page
      if (currentPage >= maxPages) {
        break;
      }

      // Move to next page
      currentPage++;

      // Add delay before next request
      if (currentPage <= maxPages) {
        await sleep(pageDelayMs);
      }
    } catch (error) {
      console.error(`Error fetching page ${currentPage}:`, error);
      throw error;
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      currentPage: maxPages,
      totalPages: maxPages,
      itemsLoaded: totalItemsYielded,
      isComplete: true
    });
  }
}
