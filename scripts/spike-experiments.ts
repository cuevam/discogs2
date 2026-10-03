// Temporary Phase 2 experiments (T2.2–T2.5). Removed in T6.2.
import { chromium, Browser } from 'patchright';
import { DiscogsMarketplace, SearchParams, SearchResult } from 'discogs-marketplace-api-nodejs';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let browser: Browser;
let n = 0;

async function run(label: string, params: SearchParams): Promise<SearchResult> {
  await sleep(3000);
  const t = Date.now();
  const r = await DiscogsMarketplace.search(params, browser);
  n++;
  console.log(`\n[${label}] ${Date.now() - t} ms  total=${r.total}  items=${r.items.length}`);
  return r;
}

const count = (xs: Array<string | number | null | undefined>) =>
  Object.entries(xs.reduce<Record<string, number>>((a, x) => ((a[String(x)] = (a[String(x)] ?? 0) + 1), a), {}))
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  ');

async function main() {
  browser = await chromium.launch({ headless: true, chromiumSandbox: false });
  try {
    // T2.2 styles: AND vs OR, and a multi-ID style.
    const base: SearchParams = { formats: ['Vinyl'], limit: 25 };
    const dt = await run('style Dub Techno', { ...base, styles: ['Dub Techno'] });
    const mi = await run('style Minimal', { ...base, styles: ['Minimal'] });
    const both = await run('style Dub Techno + Minimal', { ...base, styles: ['Dub Techno', 'Minimal'] });
    console.log(`  => ${both.total < Math.min(dt.total, mi.total) ? 'AND' : 'OR'}`);
    const dub = await run('style Dub (multi-ID)', { ...base, styles: ['Dub'] });
    const dtDub = await run('style Dub Techno + Dub', { ...base, styles: ['Dub Techno', 'Dub'] });
    console.log(`  => ${dtDub.total < Math.min(dt.total, dub.total) ? 'AND' : 'OR'} (Dub Techno=${dt.total}, Dub=${dub.total})`);
    const unk = await run('style unknown', { ...base, styles: ['Not A Style' as never] });
    const vinyl = await run('vinyl only', base);
    console.log(`  unknown style total == vinyl total? ${unk.total === vinyl.total}`);

    // T2.3 countries, unrepaired table: does every item match, and is code resolved?
    for (const code of ['US', 'GB', 'DE', 'CZ', 'JP']) {
      const r = await run(`from ${code}`, { ...base, from: [code as never], limit: 100 });
      console.log(`  codes: ${count(r.items.map((i) => i.country.code))}`);
      console.log(`  names: ${count(r.items.map((i) => i.country.name))}`);
    }

    // T2.4 conditions and years.
    const vgp = await run('media VG+', { ...base, mediaConditions: ['Very Good Plus (VG+)'], limit: 100 });
    console.log(`  media: ${count(vgp.items.map((i) => i.condition.media.short))}`);
    const yrs = await run('years 1990-1999', { ...base, years: { min: 1990, max: 1999 }, limit: 100 });
    const ys = yrs.items.map((i) => i.release.year);
    console.log(`  out of range: ${ys.filter((y) => y !== null && (y < 1990 || y > 1999)).length}, null: ${ys.filter((y) => y === null).length}`);

    // Currency filter, sorts.
    const usd = await run('currency USD', { ...base, currencies: ['USD'], limit: 50 });
    console.log(`  price currencies: ${count(usd.items.map((i) => i.price.base?.split(' ')[1]))}`);
    for (const sort of ['seller,asc', 'artist,asc', 'label,asc', 'catno,asc'] as const) {
      const r = await run(`sort ${sort}`, { ...base, query: 'oren ambarchi', sort, limit: 8 });
      console.log(`  ${r.items.map((i) => (sort.startsWith('seller') ? i.seller.name : sort.startsWith('artist') ? i.artists[0]?.name : i.id)).join(' | ')}`);
    }

    // T3.2 seller lookup + sellerIds.
    for (const name of ['endofanear', 'Waterloorecords', 'breakawayrecords', 'no-such-user-zz9']) {
      const res = await fetch(`https://api.discogs.com/users/${encodeURIComponent(name)}`, { headers: { 'User-Agent': 'DiscogsMassExport/1.0' } });
      const id = res.ok ? ((await res.json()) as { id: number }).id : null;
      console.log(`\nseller ${name}: HTTP ${res.status} id=${id}`);
      if (id) {
        const r = await run(`seller ${name}`, { sellerIds: [id], limit: 50 });
        console.log(`  sellers: ${count(r.items.map((i) => i.seller.name))}`);
      }
    }

    // T2.5 availability.
    const all = await run('vinyl 250, showUnavailable default', { ...base, limit: 250 });
    console.log(`  isAvailable: ${count(all.items.map((i) => i.isAvailable))}`);
    const avail = await run('vinyl showUnavailable=false', { ...base, showUnavailable: false });
    console.log(`  total default=${vinyl.total} vs showUnavailable=false ${avail.total}`);

    // Release ID filter.
    const rel = await run('releaseIds [8435740]', { releaseIds: [8435740], sort: 'price,asc', limit: 50 });
    console.log(`  release ids: ${count(rel.items.map((i) => i.release.id))}`);
  } finally {
    await browser.close();
    console.log(`\nrequests: ${n}`);
  }
}

main().catch((err) => {
  console.error('EXPERIMENT FAILED:', err);
  process.exit(1);
});
