// Temporary spike (T1.3): prove the new shop API works from this machine. Removed in T6.2.
import { chromium } from 'patchright';
import { DiscogsMarketplace } from 'discogs-marketplace-api-nodejs';

async function main() {
  const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
  try {
    const params = { query: 'oren ambarchi', formats: ['Vinyl' as const], sort: 'price,asc' as const, limit: 25 };

    let t = Date.now();
    const page1 = await DiscogsMarketplace.search(params, browser);
    console.log(`page 1: ${Date.now() - t} ms, total=${page1.total}, items=${page1.items.length}, nextCursor=${page1.nextCursor}`);
    console.log(JSON.stringify(page1.items[0], null, 2));

    if (page1.nextCursor) {
      t = Date.now();
      const page2 = await DiscogsMarketplace.search({ ...params, after: page1.nextCursor }, browser);
      console.log(`page 2: ${Date.now() - t} ms, items=${page2.items.length}, first id=${page2.items[0]?.id} (page 1 first id=${page1.items[0]?.id})`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('SPIKE FAILED:', err);
  process.exit(1);
});
