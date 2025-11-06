/**
 * Core exporter: export Discogs marketplace listings by style to CSV
 */

import * as fs from 'fs';
import * as path from 'path';
import { DiscogsMarketplace, SearchParams } from 'discogs-marketplace-api-nodejs';
import { parsePriceField, escapeCsv, extractYear, computeDecade } from './priceUtils';

export interface ExportOptions {
  styles?: string[];  // Made optional
  genre?: string;
  format?: string;
  fromCountry?: string;
  artist?: string;
  minYear?: number;
  maxYear?: number;
  currency?: string;
  sort?: string;
  outputPath: string;
  pageDelayMs?: number;
}

// No mapping functions needed - the API accepts plain strings

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Export marketplace listings by style to CSV
 */
export async function exportByStyle(options: ExportOptions): Promise<void> {
  const {
    styles,
    genre,
    format,
    fromCountry,
    artist,
    minYear,
    maxYear,
    currency,
    sort,
    outputPath,
    pageDelayMs = 1000
  } = options;

  // Build search params using the SearchParamsLegacy interface
  const searchParams: SearchParams = {
    api: 'legacy' as const,
    limit: 250,
    sort: (sort as any) || 'listed,desc',
    page: 1
  };

  if (styles && styles.length > 0) {
    searchParams.styles = styles;
  }

  if (genre) {
    searchParams.genre = genre as any;
  }
  if (format) {
    searchParams.formats = [format as any];
  }
  if (fromCountry) {
    searchParams.from = fromCountry as any;
  }
  if (currency) {
    searchParams.currency = currency as any;
  }
  if (artist) {
    searchParams.query = artist;
  }
  if (minYear !== undefined || maxYear !== undefined) {
    searchParams.years = {} as any;
    if (minYear !== undefined) (searchParams.years as any).min = minYear;
    if (maxYear !== undefined) (searchParams.years as any).max = maxYear;
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create write stream
  const writeStream = fs.createWriteStream(outputPath);
  
  // Write CSV header
  const header = [
    'title', 'artists', 'formats',
    'price', 'shipping', 'total', 'currency',
    'have', 'want',
    'seller_name', 'seller_url', 'seller_score',
    'seller_country_name', 'seller_country_code',
    'year', 'decade',
    'condition_media', 'condition_sleeve',
    'labels', 'catalog_numbers',
    'description',
    'listed_at',
    'listing_url',
    'release_id', 'release_url',
    'image_url'
  ].join(',') + '\n';
  
  writeStream.write(header);

  let totalItemsExported = 0;
  let currentPage = 1;
  let maxPages = 400; // Discogs limit

  const searchDesc = styles && styles.length > 0 
    ? `styles: ${styles.join(', ')}` 
    : artist 
      ? `artist: ${artist}`
      : 'all listings';
  console.log(`Starting export for ${searchDesc}`);
  console.log(`Search params:`, JSON.stringify(searchParams, null, 2));

  while (currentPage <= maxPages) {
    searchParams.page = currentPage;
    
    console.log(`Fetching page ${currentPage}...`);
    
    try {
      const result = await DiscogsMarketplace.search(searchParams);
      
      // Update max pages from response
      if (result.page && result.page.total) {
        maxPages = Math.min(result.page.total, 400);
      }

      // Check if we have items
      if (!result.items || result.items.length === 0) {
        console.log('No more items found. Stopping.');
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

        // Build CSV row
        const row = [
          escapeCsv(item.title),
          escapeCsv(artists),
          escapeCsv(formats),
          escapeCsv(price),
          escapeCsv(shipping),
          escapeCsv(total),
          escapeCsv(currencyCode),
          escapeCsv(item.community?.have),
          escapeCsv(item.community?.want),
          escapeCsv(item.seller?.name),
          escapeCsv(item.seller?.url),
          escapeCsv(item.seller?.score),
          escapeCsv(item.country?.name),
          escapeCsv(item.country?.code),
          escapeCsv(year),
          escapeCsv(decade),
          escapeCsv(item.condition?.media?.short),
          escapeCsv(item.condition?.sleeve?.short),
          escapeCsv(labels),
          escapeCsv(catalogNumbers),
          escapeCsv(item.description),
          escapeCsv(item.listedAt?.toISOString()),
          escapeCsv(item.url),
          escapeCsv(item.release?.id),
          escapeCsv(item.release?.url),
          escapeCsv(item.imageUrl)
        ].join(',') + '\n';

        writeStream.write(row);
        totalItemsExported++;
      }

      console.log(`Page ${currentPage} complete. Total items exported: ${totalItemsExported}`);

      // Check if we've reached the last page
      if (currentPage >= maxPages) {
        console.log(`Reached maximum page limit (${maxPages}). Stopping.`);
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

  // Close the stream
  writeStream.end();
  
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  console.log(`\nExport complete!`);
  console.log(`Total items exported: ${totalItemsExported}`);
  console.log(`Output file: ${outputPath}`);
}
