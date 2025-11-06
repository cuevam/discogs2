#!/usr/bin/env node

/**
 * CLI wrapper for discogs-mass-export
 */

import { exportByStyle } from './exportStyle';

interface CliArgs {
  styles?: string[];  // Made optional
  genre?: string;
  format?: string;
  from?: string;
  artist?: string;
  minYear?: number;
  maxYear?: number;
  currency?: string;
  sort?: string;
  output?: string;
  delayMs?: number;
}

/**
 * Parse command-line arguments
 */
function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    
    if (arg.startsWith('--')) {
      const key = arg.substring(2);
      const value = argv[i + 1];
      
      switch (key) {
        case 'style':
        case 'styles':
          // Support both singular and plural, comma-separated values
          if (value) {
            if (!args.styles) args.styles = [];
            args.styles.push(...value.split(',').map(s => s.trim()));
          }
          i++;
          break;
        case 'genre':
          args.genre = value;
          i++;
          break;
        case 'format':
          args.format = value;
          i++;
          break;
        case 'from':
          args.from = value;
          i++;
          break;
        case 'artist':
          args.artist = value;
          i++;
          break;
        case 'minYear':
          args.minYear = parseInt(value, 10);
          i++;
          break;
        case 'maxYear':
          args.maxYear = parseInt(value, 10);
          i++;
          break;
        case 'currency':
          args.currency = value;
          i++;
          break;
        case 'sort':
          args.sort = value;
          i++;
          break;
        case 'output':
          args.output = value;
          i++;
          break;
        case 'delayMs':
          args.delayMs = parseInt(value, 10);
          i++;
          break;
        default:
          console.warn(`Unknown argument: ${arg}`);
      }
    }
  }
  
  return args;
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Usage: npm run export:style -- [--style <name>] [--artist <name>] [options]
   or: npm run export:style -- --styles <name1>,<name2>,... [options]

At least one filter required (style, artist, genre, etc.):
  --style <name>        Music style to search for (can be used multiple times)
  --styles <list>       Comma-separated list of styles
  --artist <name>       Artist name filter (e.g., "Kraftwerk")

Optional:
  --genre <name>        Genre filter (e.g., "Rock")
  --format <name>       Format filter (e.g., "Vinyl") [default: Vinyl]
  --from <country>      Seller/shipping country filter (e.g., "United States", "Germany")
  --artist <name>       Artist name filter (e.g., "Kraftwerk")
  --minYear <number>    Minimum release year filter
  --maxYear <number>    Maximum release year filter
  --currency <code>     Currency code (e.g., "USD")
  --sort <field,dir>    Sort order: listed, condition, artist, title, label, seller, price
                        Direction: asc or desc [default: listed,desc]
                        Examples: price,asc | seller,desc | condition,desc
  --output <path>       Output CSV file path [default: exports/discogs_<name>_export.csv]
  --delayMs <number>    Delay between pages in milliseconds [default: 1000]

Examples:
  npm run export:style -- --style Krautrock --genre Rock --format Vinyl
  npm run export:style -- --style Experimental --style Electro --genre Electronic
  npm run export:style -- --styles "Experimental,Electro" --genre Electronic
  npm run export:style -- --style Krautrock --artist Kraftwerk --format Vinyl
  npm run export:style -- --style Krautrock --from US --minYear 1970 --maxYear 1979
`);
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  
  // Validate that at least one search criteria is provided
  const hasSearchCriteria = 
    (args.styles && args.styles.length > 0) || 
    args.artist || 
    args.genre;
    
  if (!hasSearchCriteria) {
    console.error('Error: At least one search filter is required (--style, --artist, or --genre)\n');
    printUsage();
    process.exit(1);
  }
  
  // Set defaults
  const styles = args.styles;
  const format = args.format || 'Vinyl';
  const outputName = args.artist || (styles && styles.length > 0 ? styles.join('_') : 'export');
  const outputPath = args.output || `exports/discogs_${outputName}_export.csv`;
  const pageDelayMs = args.delayMs || 1000;
  
  try {
    await exportByStyle({
      styles,
      genre: args.genre,
      format,
      fromCountry: args.from,
      artist: args.artist,
      minYear: args.minYear,
      maxYear: args.maxYear,
      currency: args.currency,
      sort: args.sort,
      outputPath,
      pageDelayMs
    });
    
    console.log('\n✅ Export completed successfully!');
  } catch (error) {
    console.error('\n❌ Export failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the CLI
main();
