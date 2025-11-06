/**
 * Helpers for parsing price strings and working with CSV data
 */

/**
 * Parse a price field string like "12.34 EUR" into numeric value and currency
 */
export function parsePriceField(str: string | null | undefined): {
  value: number | null;
  currency: string | null;
} {
  if (!str || typeof str !== 'string') {
    return { value: null, currency: null };
  }

  // Trim whitespace
  const trimmed = str.trim();
  if (!trimmed) {
    return { value: null, currency: null };
  }

  // Match pattern like "12.34 USD" or "1,234.56 EUR"
  // Allow for optional commas in the number
  const match = trimmed.match(/^([\d,]+\.?\d*)\s+([A-Z]{3})$/i);
  if (!match) {
    return { value: null, currency: null };
  }

  const numStr = match[1].replace(/,/g, ''); // Remove commas
  const currency = match[2].toUpperCase();
  const value = parseFloat(numStr);

  if (isNaN(value)) {
    return { value: null, currency };
  }

  return { value, currency };
}

/**
 * Escape a value for safe CSV output
 * Quotes fields that contain commas, quotes, or newlines
 */
export function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/**
 * Extract a 4-digit year (19xx or 20xx) from a description string
 */
export function extractYear(description: string | undefined | null): number | null {
  if (!description) {
    return null;
  }

  // Look for 4-digit years starting with 19 or 20
  const match = description.match(/\b(19\d{2}|20\d{2})\b/);
  if (!match) {
    return null;
  }

  return parseInt(match[1], 10);
}

/**
 * Convert a year to its decade (e.g., 1975 -> "70s")
 */
export function computeDecade(year: number | null): string | null {
  if (year === null || isNaN(year)) {
    return null;
  }

  const decade = Math.floor(year / 10) % 10;
  return `${decade}0s`;
}
