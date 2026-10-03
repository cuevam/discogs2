/**
 * Seller-country ("ships from") filter resolution.
 *
 * Two problems with the underlying library force this module to exist:
 *
 *  1. `SearchParams.from` must be an exact, upper-case ISO country CODE (e.g.
 *     'US', 'DE'). Passing a country NAME ("United States") or a lower-case code
 *     ("us") makes the library's internal reverse-lookup fail, and it then
 *     silently DROPS the `ships_from` URL param — so the search returns every
 *     country instead of erroring. That is why the filter "does nothing".
 *
 *  2. The library turns the code back into a country name for the URL by taking
 *     the FIRST name it finds for that code in its country table. That table
 *     lists the long ISO names before Discogs' own short names, so 'US' becomes
 *     "United States of America" and 'GB' becomes "United Kingdom of Great
 *     Britain and Northern Ireland" — names Discogs rejects with HTTP 403,
 *     breaking the search entirely for those countries.
 *
 * We fix (2) by trimming the shared country table so that when several names map
 * to one code, only the shortest (which matches Discogs' convention, e.g.
 * "United States", "United Kingdom") survives — the library then emits a name
 * Discogs accepts. We fix (1) by resolving any name or code, case-insensitively,
 * to the canonical code before it reaches the library.
 */

import CountryTableDefault from 'discogs-marketplace-api-nodejs/dist/data/country.data.js';

/** name -> ISO code, mutated in place so the library sees our repair. */
const CountryTable = CountryTableDefault as unknown as Record<string, string>;

// --- Repair (2): keep only the shortest name per code. ---
(function repairCountryTable(): void {
  const namesByCode = new Map<string, string[]>();
  for (const name of Object.keys(CountryTable)) {
    const code = CountryTable[name];
    if (!code) continue; // skip empty codes (e.g. "Neutral Zone")
    const names = namesByCode.get(code);
    if (names) names.push(name);
    else namesByCode.set(code, [name]);
  }
  for (const names of namesByCode.values()) {
    if (names.length < 2) continue;
    const keep = names.reduce((a, b) => (b.length < a.length ? b : a));
    for (const name of names) {
      if (name !== keep) delete CountryTable[name];
    }
  }
})();

// --- Resolve (1): build a lower-cased lookup of both names and codes. ---
const codeByInput = new Map<string, string>();
for (const name of Object.keys(CountryTable)) {
  const code = CountryTable[name];
  if (!code) continue;
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
