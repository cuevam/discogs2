# discogs-mass-export

A personal CLI tool to mass export Discogs marketplace listings by music style.

## Features

- 🎵 Export marketplace listings filtered by **style** (e.g., Krautrock, Ambient, Jazz-Funk)
- 🔍 Additional filters: genre, format, country, year range, currency
- 📊 Exports to CSV with comprehensive data including prices, seller info, release details
- 🚀 Handles pagination automatically (up to 400 pages, 250 items per page)
- ⏱️ Rate-limited requests to respect Discogs servers
- 💾 Memory-efficient streaming to CSV (doesn't load all data into memory)

## Installation

```bash
npm install
```

**Note:** This package requires Node.js >= 20.0.0 (you may see warnings on Node 18, but it should still work).

## Usage

### Basic Export

Export all Krautrock vinyl releases:

```bash
npm run export:style -- --style Krautrock --genre Rock --format Vinyl
```

### Filter by Country

Export only from US sellers:

```bash
npm run export:style -- --style Krautrock --genre Rock --format Vinyl --from US
```

### Filter by Year Range

Export 1970s releases:

```bash
npm run export:style -- --style Krautrock --genre Rock --format Vinyl --minYear 1970 --maxYear 1979
```

### Custom Output File

```bash
npm run export:style -- --style Krautrock --output my_custom_export.csv
```

## CLI Options

| Option | Required | Description | Example |
|--------|----------|-------------|---------|
| `--style` | ✅ Yes | Music style to search for | `Krautrock` |
| `--genre` | ❌ No | Genre filter | `Rock` |
| `--format` | ❌ No | Format filter (default: Vinyl) | `Vinyl`, `CD`, `Cassette` |
| `--from` | ❌ No | Seller country code | `US`, `DE`, `UK` |
| `--minYear` | ❌ No | Minimum release year | `1970` |
| `--maxYear` | ❌ No | Maximum release year | `1979` |
| `--currency` | ❌ No | Currency code | `USD`, `EUR`, `GBP` |
| `--output` | ❌ No | Output CSV file path | `my_export.csv` |
| `--delayMs` | ❌ No | Delay between pages in ms (default: 1000) | `1500` |

## Output CSV Columns

The exported CSV includes the following columns:

- **title** - Release title
- **artist** - Artist name
- **style** - Music style
- **genre** - Music genre
- **formats** - Release formats (e.g., "Vinyl, LP")
- **price** - Base price (numeric)
- **shipping** - Shipping cost (numeric)
- **total** - Total price (price + shipping)
- **currency** - Currency code
- **have** - Number of users who have this release
- **want** - Number of users who want this release
- **seller_name** - Seller's name
- **seller_url** - Seller's profile URL
- **from_country_name** - Seller's country name
- **from_country_code** - Seller's country code
- **year** - Release year (extracted from description)
- **decade** - Release decade (e.g., "70s")
- **description** - Full listing description
- **listing_url** - Marketplace listing URL
- **release_id** - Discogs release ID
- **release_url** - Discogs release page URL
- **image_url** - Release cover image URL

## How It Works

1. **Search** - Uses `discogs-marketplace-api-nodejs` in legacy mode to search the Discogs marketplace
2. **Filter** - Applies style (required) and optional filters (genre, format, country, years)
3. **Paginate** - Fetches up to 400 pages with 250 items per page (100,000 max listings)
4. **Parse** - Extracts price, shipping, seller info, and release details from each listing
5. **Stream** - Writes directly to CSV file without loading all data into memory
6. **Throttle** - Adds configurable delay between requests to be respectful to Discogs

## Project Structure

```
discogs-mass-export/
├── src/
│   ├── cli.ts           # CLI argument parser and main entry point
│   ├── exportStyle.ts   # Core export logic with pagination
│   └── priceUtils.ts    # Price parsing and CSV utilities
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Build TypeScript

```bash
npm run build
```

### Run Directly (without build)

```bash
npm run export:style -- --style <style> [options]
```

## Limitations

- Maximum 400 pages (Discogs API limitation)
- 250 items per page (maximum supported by Discogs)
- Rate limiting required (default 1s delay between pages)
- Requires Node.js >= 20.0.0 for the discogs-marketplace-api-nodejs package

## License

MIT
