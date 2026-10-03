# 02 — Mapping reference

Keep [src/lib/types.ts](../../src/lib/types.ts) (`SearchOptions`, `ListingData`,
`EstimateResult`, `ProgressUpdate`) **unchanged**. Everything below happens inside
[src/lib/exporter.ts](../../src/lib/exporter.ts).

## A. `SearchOptions` (ours) → `SearchParams` (new library)

| Our field | New param | Rule | Notes |
|---|---|---|---|
| `artist` | `query` | pass through if non-empty | Free-text "General Search". |
| `styles[]` | `styles[]` | **validate every name** against the library's style table first; throw on unknown | New lib silently drops unknown names → would return unfiltered results (T2.2, T3.3). |
| `genre` | `genres: [genre]` | wrap | |
| `format` | `formats: [format]` | wrap | UI default `Vinyl`. |
| `formatDescription` | `formatDescriptions: [x]` | wrap | |
| `fromCountry` | `from: [code]` | `resolveSellerCountry()` → code, throw on unknown | Keep the existing loud-failure behaviour. See T2.3 for the name list sent. |
| `currency` | `currencies: [x]` | wrap | |
| `condition` | `mediaConditions: [x]` | wrap | UI values like `Very Good Plus (VG+)` match the lib's `Condition` type. Confirm in T2.4 whether "VG+" means exactly VG+ or "VG+ and better". |
| `minYear` / `maxYear` | `years: { min, max }` | **both keys required** by the new type | If only one given: fill `min` with `1900` or `max` with the current year + 1. |
| `seller` (username) | `sellerIds: [id]` | resolve via `api.discogs.com/users/{name}` → `id`, cached | T3.2. Unknown user → clear error. |
| `releaseId` | `releaseIds: [id]` | | Old code: mutually exclusive, first of release → master → label → artist. **Keep that precedence** to preserve behaviour. |
| `masterId` | `masterIds: [id]` | | |
| `labelId` | `labelIds: [id]` | | |
| `artistId` | `artistIds: [id]` | | |
| `sort` | `sort` | pass through if supported; `label,*` and `catno,*` → `listed,desc` + warning | Decision D3 in [05](05-risks-and-rollback.md#open-decisions). |
| — | `limit: 250` | constant `PER_PAGE` | Max allowed is 250. |
| — | `after` | cursor from previous page | Omit on first page. |
| `pageDelayMs` | — | ignored (already ignored today; limiter paces) | |
| `maxItems` | — | enforced in our loop | |

Defaults left untouched: `showUnavailable` (lib default `true`, as before),
`hideGenericSleeves`, `hideSleevelessMedia`, `hasItemPhotos`, `isMakeAnOfferOnly`.
Check in T2.5 whether `showUnavailable: true` includes sold/on-hold items. If so,
set it to `false`.

## B. New result item → `ListingData`

| `ListingData` field | Source in new item | Change vs today |
|---|---|---|
| `id` | `item.id` | same |
| `title` | `item.title` | same format `Artists - Title (Format)` |
| `artists` | `item.artists.map(a => a.name).join('; ')` | same |
| `formats` | `item.formats.join('; ')` | now includes format descriptions too |
| `price`, `shipping`, `total`, `currency` | `parsePriceField(item.price.base / .shipping)` | same parser works |
| `have`, `want` | `item.community.have / want` | same |
| `seller_name` | `item.seller.name` | same |
| `seller_url` | `item.seller.url` | same shape |
| `seller_score` | `parseFloat(item.seller.score)` | same |
| `seller_country_name` | `item.country.name` | same |
| `seller_country_code` | `item.country.code` | same |
| `year` | **`item.release.year`**, fallback `extractYear(item.description)` | better: real release year |
| `decade` | `computeDecade(year)` | same |
| `condition_media` | `item.condition.media.short` | same |
| `condition_sleeve` | `item.condition.sleeve.short` | same (`null` for Generic/No Cover — unchanged behaviour) |
| `labels` | `item.labels.map(l => l.name).join('; ')` | same |
| `catalog_numbers` | `item.catnos.join('; ')` | same |
| `description` | `item.description` | **now the seller's notes** (was release description text) |
| `listed_at` | `item.listedAt?.toISOString()` | same |
| `listing_url` | `item.url` | `/shop/item/<id>` instead of `/sell/item/<id>` — both open the listing |
| `release_id` | `item.release.id` | same |
| `release_url` | `item.release.url` | same |
| `image_url` | `item.imageUrl` | now a webp thumbnail |

Drop the `any` typing: import `SearchResult` from the library and type the
mapper as `(item: SearchResult['items'][number]) => ListingData`.

## C. Pagination → `EstimateResult` / `ProgressUpdate`

| Field | New computation |
|---|---|
| `totalItems` | `result.total` |
| `perPage` | `PER_PAGE` (250) |
| `totalPages` | `Math.ceil(total / PER_PAGE)` |
| `cappedPages` | `Math.min(totalPages, MAX_PAGES)`, where `MAX_PAGES` comes from experiment T2.1 |
| `fetchableItems` | `Math.min(totalItems, cappedPages * PER_PAGE)` |
| `requestsForAll` | `cappedPages` (pages, as the UI shows today) |
| `estimatedTimeMsAll` | `discogsLimiter.estimateDurationMs(cappedPages)` + browser overhead factor from T2.5 |
| `firstPageItems` | mapped page-1 items |
| `ProgressUpdate.currentPage` | our own counter (1, 2, 3…) |
| `ProgressUpdate.totalPages` | `min(cappedPages, pageCap)` as today |

**Estimate → search hand-off:** the web client runs `/api/estimate`, shows the
modal, and on confirm opens `/api/search`, which starts again from page 1
([web/src/App.tsx](../../web/src/App.tsx)). That stays valid with cursors, so
don't try to pass cursors between the two requests.
