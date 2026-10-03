/**
 * Seller-country ("ships from") filter resolution.
 *
 * `SearchParams.from` takes upper-case ISO country CODES (e.g. 'US', 'DE'). The
 * library turns each code into every country name its table maps to that code
 * and sends them all, so the filter matches whichever name Discogs uses
 * ("United States", "Czech Republic", ...). The same table maps each listing's
 * country name back to a code.
 *
 * An unrecognised value must never reach the library: it would be sent as-is
 * and match nothing useful. So we resolve any name or code, case-insensitively,
 * to the canonical code first, and callers fail loudly on `null`.
 *
 * Note: the table must stay unmodified. An earlier version trimmed it to one
 * name per code for the old library, which turned 'CZ' into "Czechia" and broke
 * both the filter and the code lookup on the new shop API.
 */

import CountryTableDefault from 'discogs-marketplace-api-nodejs/dist/data/country.data.js';

/** name -> ISO code */
const CountryTable = CountryTableDefault as unknown as Record<string, string>;

// Build a lower-cased lookup of both names and codes.
const codeByInput = new Map<string, string>();
for (const name of Object.keys(CountryTable)) {
  const code = CountryTable[name];
  if (!code) continue; // skip empty codes (e.g. "Neutral Zone")
  codeByInput.set(name.toLowerCase(), code);
  codeByInput.set(code.toLowerCase(), code);
}

/**
 * Resolve a user-supplied seller country (name or ISO code, any case) to the
 * canonical ISO code the marketplace library expects, or `null` if unknown.
 */
export function resolveSellerCountry(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (!key) return null;
  return codeByInput.get(key) ?? null;
}
