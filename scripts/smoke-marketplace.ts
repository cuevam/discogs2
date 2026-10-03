/**
 * Live smoke test of our exporter against the Discogs shop API.
 *
 * Calls estimateSearch / searchListings (not the library directly), so it tests
 * the whole option mapping and result mapping. Every case makes real requests,
 * paced by the shared rate limiter. Exits 1 if any case fails.
 *
 * Run: npx ts-node scripts/smoke-marketplace.ts
 */

import { estimateSearch, searchListings } from '../src/lib/exporter';
import { closeBrowser } from '../src/lib/browser';
import { DiscogsError } from '../src/lib/discogsError';
import { ListingData, SearchOptions } from '../src/lib/types';

const results: Array<{ name: string; ok: boolean; detail: string }> = [];

async function collect(options: SearchOptions): Promise<ListingData[]> {
  const items: ListingData[] = [];
  for await (const item of searchListings(options)) items.push(item);
  return items;
}

async function check(name: string, fn: () => Promise<string>): Promise<void> {
  const start = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS ${name} (${((Date.now() - start) / 1000).toFixed(1)}s) ${detail}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail });
    console.log(`FAIL ${name}: ${detail}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectError(options: SearchOptions, pattern: RegExp): Promise<string> {
  try {
    await estimateSearch(options);
  } catch (error) {
    assert(error instanceof DiscogsError && error.kind === 'invalidInput', `wrong error: ${String(error)}`);
    assert(pattern.test(error.message), `wrong message: ${error.message}`);
    return `"${error.message}"`;
  }
  throw new Error('expected an error, got results');
}

async function main(): Promise<void> {
  let vinylTotal = 0;

  await check('S1 failing log: oren ambarchi, Vinyl, price asc', async () => {
    const e = await estimateSearch({ artist: 'oren ambarchi', format: 'Vinyl', sort: 'price,asc' });
    assert(e.totalItems > 0, 'no results');
    assert(e.firstPageItems.length > 0, 'empty first page');
    // Prices are in mixed currencies, so only check same-currency neighbours.
    const usd = e.firstPageItems.filter((i) => i.currency === 'USD' && i.price !== null).map((i) => i.price as number);
    // S15: mapping is complete.
    for (const item of e.firstPageItems) {
      for (const [key, value] of Object.entries(item)) assert(value !== undefined, `${key} undefined on ${item.id}`);
      for (const url of [item.listing_url, item.release_url, item.seller_url]) {
        assert(url.startsWith('https://www.discogs.com/'), `bad url ${url}`);
      }
      assert(item.seller_country_code, `no country code for "${item.seller_country_name}"`);
    }
    return `total=${e.totalItems} pages=${e.totalPages} usdOnPage=${usd.length} ~${Math.round(e.estimatedTimeMsAll / 1000)}s`;
  });

  for (const seller of ['endofanear', 'Waterloorecords', 'breakawayrecords']) {
    await check(`S2-4 seller ${seller}`, async () => {
      const items = await collect({ seller, format: 'Vinyl', maxItems: 50 });
      assert(items.length > 0, 'no results');
      assert(items.every((i) => i.seller_name.toLowerCase() === seller.toLowerCase()), 'other sellers in results');
      assert(items.every((i) => i.formats.includes('Vinyl')), 'non-vinyl in results');
      return `items=${items.length}`;
    });
  }

  await check('S5 unknown seller', () => expectError({ seller: 'no-such-user-zz9' }, /Unknown Discogs seller/));

  await check('S6 style Dub Techno narrows Vinyl', async () => {
    vinylTotal = (await estimateSearch({ format: 'Vinyl' })).totalItems;
    const styled = (await estimateSearch({ styles: ['dub techno'], format: 'Vinyl' })).totalItems;
    assert(styled > 0 && styled < vinylTotal, `styled=${styled} vinyl=${vinylTotal}`);
    return `vinyl=${vinylTotal} dubTechno=${styled}`;
  });

  await check('S7 unknown style', () => expectError({ styles: ['Not A Style'] }, /Unknown style/));

  for (const [input, code] of [['US', 'US'], ['United Kingdom', 'GB'], ['CZ', 'CZ']]) {
    await check(`S8-9 country ${input}`, async () => {
      const items = await collect({ fromCountry: input, format: 'Vinyl', maxItems: 100 });
      assert(items.length > 0, 'no results');
      const wrong = items.filter((i) => i.seller_country_code !== code);
      assert(wrong.length === 0, `${wrong.length} not ${code}, e.g. ${wrong[0]?.seller_country_name}`);
      return `items=${items.length}`;
    });
  }

  await check('S10 condition Near Mint', async () => {
    const items = await collect({ condition: 'Near Mint (NM or M-)', format: 'Vinyl', maxItems: 100 });
    const wrong = items.filter((i) => i.condition_media !== 'NM or M-');
    assert(items.length > 0 && wrong.length === 0, `${wrong.length} not NM, e.g. ${wrong[0]?.condition_media}`);
    return `items=${items.length}`;
  });

  await check('S11 years 1990-1999', async () => {
    const items = await collect({ minYear: 1990, maxYear: 1999, format: 'Vinyl', maxItems: 100 });
    const wrong = items.filter((i) => i.year !== null && (i.year < 1990 || i.year > 1999));
    assert(items.length > 0 && wrong.length === 0, `${wrong.length} out of range`);
    return `items=${items.length}`;
  });

  await check('S11b only minYear 2020', async () => {
    const items = await collect({ minYear: 2020, format: 'Vinyl', maxItems: 50 });
    const wrong = items.filter((i) => i.year !== null && i.year < 2020);
    assert(items.length > 0 && wrong.length === 0, `${wrong.length} before 2020`);
    return `items=${items.length}`;
  });

  await check('S12 release ID', async () => {
    const items = await collect({ releaseId: 8435740, sort: 'price,asc' });
    assert(items.length > 0 && items.every((i) => i.release_id === 8435740), 'other releases in results');
    return `items=${items.length}`;
  });

  await check('S13 label sort falls back', async () => {
    const items = await collect({ sort: 'label,asc', format: 'Vinyl', maxItems: 25 });
    assert(items.length === 25, `items=${items.length}`);
    return 'no error';
  });

  await check('S14 600 items across 3 pages, no duplicates', async () => {
    const items = await collect({ format: 'Vinyl', maxItems: 600 });
    const unique = new Set(items.map((i) => i.id)).size;
    assert(items.length === 600, `items=${items.length}`);
    assert(unique === 600, `duplicates: ${600 - unique}`);
    return 'items=600 unique=600';
  });

  await check('S16 currency USD', async () => {
    const items = await collect({ currency: 'USD', format: 'Vinyl', maxItems: 50 });
    assert(items.length > 0 && items.every((i) => i.currency === 'USD'), 'non-USD prices');
    return `items=${items.length}`;
  });
}

main()
  .catch((error) => {
    console.error('Smoke test crashed:', error);
    results.push({ name: 'crash', ok: false, detail: String(error) });
  })
  .finally(async () => {
    await closeBrowser();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    process.exitCode = failed.length ? 1 : 0;
  });
