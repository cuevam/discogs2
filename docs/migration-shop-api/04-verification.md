# 04 — Verification

The project has no test framework, so verification is one smoke script plus a
manual UI pass. Both run against live Discogs. Keep runs small and space them out.

## 1. Smoke script (T5.1)

`scripts/smoke-marketplace.ts`. It calls **our** `estimateSearch` /
`searchListings` (not the library directly), so it tests the whole mapping.
Run with `npx ts-node scripts/smoke-marketplace.ts`. It exits `1` on the first failure
and always calls `closeBrowser()`.

| # | Options | Assert |
|---|---|---|
| S1 | `{ artist: 'oren ambarchi', format: 'Vinyl', sort: 'price,asc' }` (the failing log) | `totalItems > 0`; first-page prices non-decreasing |
| S2 | `{ seller: 'endofanear', maxItems: 50 }` | every `seller_name` equals `endofanear` (case-insensitive) |
| S3 | `{ seller: 'Waterloorecords', format: 'Vinyl', maxItems: 50 }` | seller matches; every `formats` contains `Vinyl` |
| S4 | `{ seller: 'breakawayrecords', maxItems: 50 }` | seller matches |
| S5 | `{ seller: 'no-such-user-zz9' }` | throws `Unknown Discogs seller` |
| S6 | `{ styles: ['Dub Techno'], format: 'Vinyl', maxItems: 250 }` | `totalItems` smaller than the Vinyl-only total |
| S7 | `{ styles: ['Not A Style'] }` | throws `Unknown style` |
| S8 | `{ fromCountry: 'US', format: 'Vinyl', maxItems: 250 }` | every `seller_country_code === 'US'` |
| S9 | `{ fromCountry: 'United Kingdom', maxItems: 100 }` | every code `GB` |
| S10 | `{ condition: 'Near Mint (NM or M-)', maxItems: 100 }` | every `condition_media` in the accepted set (per T2.4) |
| S11 | `{ minYear: 1990, maxYear: 1999, format: 'Vinyl', maxItems: 100 }` | every non-null `year` in 1990–1999 |
| S12 | `{ releaseId: <known release>, sort: 'price,asc' }` | every `release_id` matches |
| S13 | `{ sort: 'label,asc', format: 'Vinyl', maxItems: 25 }` | doesn't throw; warning logged (D3) |
| S14 | `{ format: 'Vinyl', maxItems: 600 }` | exactly 600 items across 3 pages; no duplicate `id`s |
| S15 | mapping | on S1 page 1, no `ListingData` field is `undefined`; `listing_url`, `release_url`, `seller_url` start with `https://www.discogs.com/` |

## 2. Manual UI matrix (T5.2)

Run `./start.sh`, open http://localhost:5173.

| # | Action | Expected |
|---|---|---|
| U1 | General Search "oren ambarchi", Vinyl, Price low→high → Search | Estimate modal shows item/page/time counts |
| U2 | Confirm "Fetch all" from U1 | Rows stream in, progress bar advances, completes |
| U3 | Pick `endofanear` from the Seller dropdown → Search | Only that seller's rows |
| U4 | Repeat U3 for the other two favourites | Same |
| U5 | Type an unknown seller | Clear error message, no hang |
| U6 | Toggle 2 quick-style chips | Results narrow (AND) or widen (OR), matching T2.2 |
| U7 | Seller Country = United States | All rows ship from US |
| U8 | Each Condition option once (spot-check 3) | Rows match |
| U9 | Year range 1970–1979 | Years in range |
| U10 | Each Sort option | Order matches; Label/Cat# behave per D3 |
| U11 | Advanced: Release ID / Master ID / Label ID / Artist ID | Filters apply |
| U12 | Start a big search, press Cancel | Stops; server log shows no more page requests; no Chromium left from that search |
| U13 | Two searches back to back | Second starts fast (browser reused) |
| U14 | Export CSV | Opens in a spreadsheet, columns as T0.2 reference |
| U15 | Dark/light theme, results table sorting/filtering | Unchanged |

## 3. CSV parity (T5.3)
- Same header row, same column order as the T0.2 reference, for the web export
  ([web/src/App.tsx](../../web/src/App.tsx)) and the CLI export ([src/exportStyle.ts](../../src/exportStyle.ts)).
- Expected content differences (not bugs): `description` is now the seller's notes,
  `listing_url` uses `/shop/item/`, `year` is filled more often.

## 4. Soak (T5.4)
- One "fetch all" of a ~20-page search.
- Watch: server RSS memory (`ps -o rss= -p <pid>`) stays flat between pages; no
  `403`/`429`; page spacing ≈ limiter interval; Chromium process count stays at 1.

## Experiment log
Filled in during Phase 2.

| Exp | Date | Result | Decision taken |
|---|---|---|---|
| T1.3 spike | | | |
| T2.1 page cap | | | `MAX_PAGES = ` |
| T2.2 styles | | missing: · AND/OR: | |
| T2.3 countries | | | D4: |
| T2.4 conditions/years | | | |
| T2.5 cost/availability | | per page: ms · showUnavailable: | D2: |
