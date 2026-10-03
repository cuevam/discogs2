# 01 — Findings

What broke, how we know, and what the new library does. All checks below were
run on 2026-09-28 from this machine (WSL, AT&T residential IP).

## 1. The app is not built on the official Discogs API

- The only marketplace dependency is `discogs-marketplace-api-nodejs` (installed:
  `1.14.4`), used only in [src/lib/exporter.ts](../../src/lib/exporter.ts)
  (plus its country table in [src/lib/countryFilter.ts](../../src/lib/countryFilter.ts)).
- In `api: 'legacy'` mode it fetches the **website** page
  `https://www.discogs.com/en/sell/list?...` (or `/seller/<name>/profile` for a
  seller) and parses the HTML with `linkedom`. It is a scraper.
- The official REST API (`api.discogs.com`) has **no marketplace-wide search**.
  Its closest endpoint is one seller's inventory: `/users/{username}/inventory`.

## 2. The 403 is a Cloudflare bot challenge, not a rate limit

| Request | Result |
|---|---|
| `www.discogs.com/sell/list?q=oren+ambarchi` (UA `Discogs`) | `403`, `server: cloudflare`, `cf-mitigated: challenge`, `<title>Just a moment...</title>` |
| same, with a Chrome User-Agent | same `403` challenge |
| `www.discogs.com/shop/list?...` (new shop page, UA `Discogs`) | same `403` challenge |
| `www.discogs.com/api/shop-page-api/sell_item` (old "modern" mode) | same `403` challenge |
| `api.discogs.com/users/endofanear` | `200` |
| `api.discogs.com/users/endofanear/inventory?per_page=1` | `200`, `x-discogs-ratelimit: 25` |

Conclusions:
- Blocked on the **first** request, so request volume isn't the cause. Waiting doesn't help.
- The User-Agent alone doesn't get through. What matters is the client being a
  real browser (TLS/HTTP fingerprint).
- The official API is not affected.
- A VPN test was attempted, but the VPN did not cover WSL traffic (public IP stayed
  AT&T), so an IP-reputation cause is not fully ruled out. It doesn't change the plan:
  the library author hit the same block independently.

### How the app misreports it
Any `403` is treated as a rate limit:
- [src/lib/exporter.ts:282](../../src/lib/exporter.ts#L282): search loop logs `[RATE LIMIT]` and stops.
- [src/api.ts:272](../../src/api.ts#L272): estimate returns HTTP 429 `rateLimited: true`.
- [web/src/App.tsx:57](../../web/src/App.tsx#L57): shows "Discogs is rate-limiting right now. Wait a minute and try again."
- `retryWithBackoff` retries 3× (2 s, 4 s, 8 s) — pointless against a challenge.

## 3. What the library author changed

Commit [`05c683a`](https://github.com/KirianCaumes/Discogs-Marketplace-API-NodeJS/commit/05c683a68b24f9aecf2018ae20020322ac345d14)
— "💥 Migrate to Patchright and the new Discogs shop API" (2026-09-28). Not on npm
yet (latest npm: `1.16.9`, 2026-08-23). A Feb 2026 commit "Improve some 403 issues"
shows this is a recurring fight.

### How a search now runs (`src/scrapers/marketplace.scraper.ts`)
1. Launch headless Chromium via **Patchright** (a Playwright fork built to avoid
   bot detection), or reuse a browser we pass in.
2. New browser context per call: **JavaScript disabled**, User-Agent `Discogs`
   ("which Cloudflare lets through", per the code comment).
3. New page → `goto('https://www.discogs.com/robots.txt')` to be on the Discogs origin.
4. From that page, `POST /graphql` persisted query **`MarketplaceSearch`** (filters, sort, `first`, `after`).
5. Second `POST /graphql` persisted query **`Releases`** for have/want counts and rating.
6. Map to `SearchResult`, close page and context.

So **one page of results = 3 HTTP requests** to `www.discogs.com` plus browser overhead.

### API differences that affect us
| Topic | Old (`1.14.4`, legacy) | New (`05c683a`) |
|---|---|---|
| Modes | `api: 'legacy' \| 'modern'` | single mode, `api` param removed |
| Pagination | `page` number, `result.page.total` | cursor: `after` in, `nextCursor` out; only `total` items |
| Seller | `seller: 'username'` | `sellerIds: number[]` |
| Text search | `query` | `query` |
| Genre / format / condition / currency | single value | arrays (`genres`, `formats`, `mediaConditions`, `currencies`) |
| Label / master / release / artist ID | one of, mutually exclusive | arrays, combinable |
| Sort fields | incl. `label`, `catno` | `listed, condition, sleeveCondition, artist, title, year, releaseCountry, seller, sellerRating, sellerRatingCount, shipsFrom, price` — **no `label`, no `catno`** |
| Styles | passed as names in URL | name → internal style ID; **unknown names are silently dropped** |
| Country (`from`) | one code, first matching name used | array of codes, **every** name for that code is sent |
| Year on listing | not provided (we regex the description) | `release.year` |
| `description` | release description text | **seller's notes** on the item |
| Listing URL | `/sell/item/<id>` | `/shop/item/<id>` |
| Seller score | `"99.5%"` style string | `"99.5%"` (`toFixed(1)`) |
| Price | `"12.00 USD"` | `"12.00 USD"` (JPY without decimals) — our parser handles both |
| Module format | CommonJS | CommonJS (built with `module: NodeNext`, no `"type": "module"`) — compatible with our `commonjs` tsconfig |
| Runtime deps | `linkedom` | `patchright` `^1.63.0` + a Chromium download |
| Node | — | `>=20` (we run `v22.21.1`) |

### Useful extras for later (not in this migration)
`sellerIds` (multi-seller), `priceRange`, `sellerRatingMin`, `hasItemPhotos`,
`sleeveConditions`, multi-value filters, extra sorts, `seller.isIndependent`,
`photos`, `release.rating`, `release.country`.

Note: multi-value genre/format/format-description filters are **AND**
(`genreAnd: true` etc.), not OR. Multiple styles are AND when every style maps to one ID.
