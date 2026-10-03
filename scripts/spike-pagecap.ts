// Temporary T2.1 page-cap experiment. Removed in T6.2.
import { chromium } from 'patchright';
import { DiscogsMarketplace } from 'discogs-marketplace-api-nodejs';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
  const seen = new Set<number>();
  let after: string | undefined;
  try {
    for (let page = 1; page <= 45; page++) {
      const t = Date.now();
      const r = await DiscogsMarketplace.search({ formats: ['Vinyl'], genres: ['Electronic'], showUnavailable: false, limit: 250, after }, browser);
      const dup = r.items.filter((i) => seen.has(i.id)).length;
      r.items.forEach((i) => seen.add(i.id));
      console.log(`page ${page}: ${Date.now() - t} ms items=${r.items.length} dup=${dup} total=${r.total} next=${r.nextCursor ? 'yes' : 'NULL'}`);
      if (!r.nextCursor || !r.items.length) break;
      after = r.nextCursor;
      await sleep(3000);
    }
  } catch (e) {
    console.error('FAILED:', e);
  } finally {
    await browser.close();
    console.log('unique items:', seen.size);
  }
})();
