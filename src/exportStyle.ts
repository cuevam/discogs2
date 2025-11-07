/**
 * CSV export wrapper around the shared exporter
 */

import * as fs from 'fs';
import * as path from 'path';
import { escapeCsv } from './priceUtils';
import { searchListings } from './lib/exporter';
import { SearchOptions } from './lib/types';

export interface ExportOptions extends SearchOptions {
  outputPath: string;
}

/**
 * Export marketplace listings to CSV using the shared exporter
 */
export async function exportByStyle(options: ExportOptions): Promise<void> {
  const { outputPath, ...searchOptions } = options;

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

  const searchDesc = searchOptions.styles && searchOptions.styles.length > 0 
    ? `styles: ${searchOptions.styles.join(', ')}` 
    : searchOptions.artist 
      ? `artist: ${searchOptions.artist}`
      : 'all listings';
  console.log(`Starting export for ${searchDesc}`);

  // Progress callback
  const onProgress = (progress: any) => {
    console.log(`Page ${progress.currentPage} complete. Total items exported: ${progress.itemsLoaded}`);
  };

  try {
    // Use the shared exporter
    for await (const listing of searchListings(searchOptions, onProgress)) {
      // Build CSV row
      const row = [
        escapeCsv(listing.title),
        escapeCsv(listing.artists),
        escapeCsv(listing.formats),
        escapeCsv(listing.price),
        escapeCsv(listing.shipping),
        escapeCsv(listing.total),
        escapeCsv(listing.currency),
        escapeCsv(listing.have),
        escapeCsv(listing.want),
        escapeCsv(listing.seller_name),
        escapeCsv(listing.seller_url),
        escapeCsv(listing.seller_score),
        escapeCsv(listing.seller_country_name),
        escapeCsv(listing.seller_country_code),
        escapeCsv(listing.year),
        escapeCsv(listing.decade),
        escapeCsv(listing.condition_media),
        escapeCsv(listing.condition_sleeve),
        escapeCsv(listing.labels),
        escapeCsv(listing.catalog_numbers),
        escapeCsv(listing.description),
        escapeCsv(listing.listed_at),
        escapeCsv(listing.listing_url),
        escapeCsv(listing.release_id),
        escapeCsv(listing.release_url),
        escapeCsv(listing.image_url)
      ].join(',') + '\n';

      writeStream.write(row);
      totalItemsExported++;
    }
  } catch (error) {
    console.error('Error during export:', error);
    throw error;
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
