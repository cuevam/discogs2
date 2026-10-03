# 03 — Tasks, in execution order

Each task has **Depends on**, **Files**, **Steps** and **Done when**. Do them in
order. Phase gates are in the [README](README.md#order-of-execution).

---

## Phase 0 — Prepare

### T0.1 Create the branch
- **Depends on:** —
- **Steps:**
  1. Commit or stash the current uncommitted work on `main` first (the git status
     shows many modified files; don't mix them into the migration).
  2. `git checkout -b migrate/shop-api-patchright`
- **Done when:** on the new branch with a clean working tree.

### T0.2 Baseline
- **Depends on:** T0.1
- **Steps:**
  1. `npm run build` and `cd web && npx tsc --noEmit -p .` — both must pass before any change.
  2. Save a copy of a pre-block CSV export (if one exists in `exports/`) as the
     column reference for T5.3.
- **Done when:** both builds pass and a reference CSV is noted.

---

## Phase 1 — Install

### T1.1 Install the library from the pinned commit
- **Depends on:** T0.2
- **Files:** `package.json`, `package-lock.json`
- **Steps:**
  1. `npm install discogs-marketplace-api-nodejs@1.17.0 --save-exact`
     (1.17.0, released 2026-10-01, is the same code as commit `05c683a`. Pin exactly:
     upstream shipped breaking changes as a minor version.)
  2. npm runs the package's `prepare` script (`husky && npm run build`). If it fails:
     - `git clone` the repo into a scratch dir, `git checkout 05c683a`, `npm ci`, `npm run build`, `npm pack`;
     - copy the `.tgz` into `vendor/` and `npm install ./vendor/discogs-marketplace-api-nodejs-*.tgz`.
  3. Confirm `node_modules/discogs-marketplace-api-nodejs/dist/index.js` and
     `dist/data/country.data.js` + `dist/data/style.data.js` exist.
  4. If TypeScript complains about Patchright's types, bump `@types/node` from `^18` to `^22` (we run Node 22).
- **Done when:** package installed, `dist/` present. (App build is expected to fail
  now: `api: 'legacy'`, `seller`, `page` no longer exist.)

### T1.2 Install Chromium for Patchright
- **Depends on:** T1.1
- **Steps:**
  1. `npx patchright install --with-deps chromium` (asks for sudo for system libraries on WSL/Ubuntu).
  2. If `--with-deps` fails, run `npx patchright install chromium` and install the missing
     libraries it lists with `apt`.
- **Done when:** the command finishes without errors.

### T1.3 Spike: prove it works from this machine
- **Depends on:** T1.2
- **Files:** `scripts/spike-shop-api.ts` (temporary, removed in T6.2)
- **Steps:** write a ~20-line script that:
  1. calls `DiscogsMarketplace.search({ query: 'oren ambarchi', formats: ['Vinyl'], sort: 'price,asc', limit: 25 })`;
  2. prints `total`, `nextCursor`, `items.length`, and the first item as JSON;
  3. calls again with `after: nextCursor` and prints the first item ID of page 2;
  4. times each call.

  Run with `npx ts-node scripts/spike-shop-api.ts`.
- **Done when (GATE):** real listings print, page 2 differs from page 1.
  **If it 403s:** try another network (phone hotspot) once. If it still fails, stop and
  go to [R1 in 05](05-risks-and-rollback.md#risks).

---

## Phase 2 — Experiments

Settle the unknowns before writing the real code. Record every result in
[04-verification.md § Experiment log](04-verification.md#experiment-log). Extend the spike script for each.

### T2.1 Page cap
- **Question:** does the cursor stop at some depth (e.g. 10,000 items / page 40, or 400 pages)?
- **Steps:** broad query (`formats: ['Vinyl'], genres: ['Electronic']`, `limit: 250`),
  follow `nextCursor` up to 45 pages, pausing 3 s between pages. Log page number, item count, and whether `nextCursor` is null.
- **Output:** the value for `MAX_PAGES`. If no cap is found by page 45, keep `400`.

### T2.2 Styles
- **Question:** are all `QUICK_STYLES` ([web/src/data/styles.ts](../../web/src/data/styles.ts)) known to the new library, and are multiple styles AND or OR?
- **Steps:**
  1. Import `dist/data/style.data.js` and check every `QUICK_STYLES` entry is a key. List any missing.
  2. Compare `total` for `['Dub Techno']`, `['Minimal']` and `['Dub Techno', 'Minimal']`.
- **Output:** missing-style list; AND/OR answer (smaller combined total = AND).

### T2.3 Seller countries
- **Question:** does `from: ['US']` / `['GB']` / `['DE']` filter correctly, given the library sends every name mapped to a code?
- **Steps:** run each with and without the table repair in `countryFilter.ts`; check that every returned `country.code` matches.
- **Output:** keep or remove the repair (decision D4).

### T2.4 Conditions and years
- **Steps:**
  1. `mediaConditions: ['Very Good Plus (VG+)']`: are results exactly VG+, or VG+ and better?
  2. `years: { min: 1990, max: 1999 }`: are all `release.year` values in range?
  3. `years` with only one bound filled by our defaults behaves as expected.
- **Output:** notes for the mapper, and whether the UI label "Condition" still means the same thing.

### T2.5 Cost and availability
- **Steps:**
  1. Time 10 consecutive pages with one shared browser (pass a `browser` to `search`) vs a new browser per call.
  2. Check whether `showUnavailable: true` (library default) returns items with `isAvailable: false`.
  3. Watch for any `429` or `403` during the 10 pages at 3 s spacing.
- **Output:** per-page time (→ estimate factor), `showUnavailable` value, and whether the limiter budget needs to change (decision D2).

---

## Phase 3 — Core rewrite ([src/lib/exporter.ts](../../src/lib/exporter.ts))

Split into small modules if `exporter.ts` grows past ~300 lines:
`src/lib/browser.ts`, `src/lib/sellerLookup.ts`.

### T3.1 Browser manager
- **Depends on:** Phase 2
- **Files:** `src/lib/browser.ts` (new)
- **Steps:**
  1. `getBrowser()`: lazily `chromium.launch({ headless: true, chromiumSandbox: false })` from `patchright`; reuse while `browser.isConnected()`; relaunch if it died. Guard concurrent first calls with a shared promise.
  2. `closeBrowser()`: close if open.
  3. Register `SIGINT`/`SIGTERM`/`beforeExit` handlers once to close the browser.
  4. Optional idle timeout (e.g. close after 5 min without searches) to free memory.
- **Done when:** two sequential searches reuse one Chromium process (check with `ps`).

### T3.2 Seller username → ID
- **Depends on:** T3.1
- **Files:** `src/lib/sellerLookup.ts` (new)
- **Steps:**
  1. `resolveSellerId(username)`: `fetch('https://api.discogs.com/users/' + encodeURIComponent(name), { headers: { 'User-Agent': 'DiscogsMassExport/1.0' } })` → `json.id`.
  2. Cache in a `Map` (case-insensitive key) for the process lifetime.
  3. `404` → throw `Unknown Discogs seller "<name>"`. Other non-OK → throw with status.
  4. Don't route this through `discogsLimiter`: it's a different host with its own 25–60/min budget and is called at most once per seller.
- **Done when:** `endofanear`, `Waterloorecords`, `breakawayrecords` resolve to IDs, and a made-up name gives the clear error.

### T3.3 `buildSearchParams(options, after?)`
- **Depends on:** T3.2
- **Steps:** implement [02 § A](02-mapping-reference.md#a-searchoptions-ours--searchparams-new-library). Key points:
  - becomes `async` (seller lookup);
  - validate styles against the library style table → throw `Unknown style "<x>"`;
  - keep the release → master → label → artist precedence;
  - handle sort fallback (D3);
  - fill the missing `years` bound;
  - no `any` casts. Use the library's `SearchParams` type.
- **Done when:** compiles; spike-style call with the built params returns results.

### T3.4 `mapItemToListing`
- **Depends on:** T3.3
- **Steps:** implement [02 § B](02-mapping-reference.md#b-new-result-item--listingdata), typed with `SearchResult['items'][number]`.
- **Done when:** every `ListingData` field is filled for a sample page; `year` comes from `release.year`.

### T3.5 `estimateSearch`
- **Depends on:** T3.4
- **Steps:** one `search()` call with the shared browser → build `EstimateResult` per [02 § C](02-mapping-reference.md#c-pagination--estimateresult--progressupdate).
  Keep `discogsLimiter.acquire()` before the call.
- **Done when:** the estimate for the failing log's filters returns sensible numbers.

### T3.6 `searchListings` (cursor loop)
- **Depends on:** T3.5
- **Steps:**
  1. Loop: `acquire()` → `search({ ...params, after }, browser)` → yield mapped items → progress → `after = result.nextCursor`; stop on `null`, `maxItems`, or `MAX_PAGES`.
  2. Keep the page counter for `ProgressUpdate`; compute `totalPages` from page 1's `total`.
  3. Wrap the loop in `try/finally` so an aborted stream (client cancel → generator `return()`) leaves nothing open.
  4. Keep today's behaviour: an error on page 1 throws, an error later ends the stream with what was already sent.
- **Done when:** a multi-page search streams in order with correct progress, and cancel stops requests.

### T3.7 Error classification and retry
- **Depends on:** T3.6
- **Steps:**
  1. Add `classifyError(err)`: `'blocked'` for `403` or a challenge/`Just a moment` message; `'rateLimited'` for `429`; `'network'` for Patchright timeouts or navigation errors; otherwise `'other'`.
  2. `retryWithBackoff` retries only `rateLimited` and `network`. **Never retry `blocked`.**
  3. Export a typed error (`DiscogsError` with `kind`) so `api.ts` doesn't grep message strings.
  4. In the search loop, `blocked` mid-search → progress with `rateLimited: false` and a new `blocked: true` field (optional in `ProgressUpdate`, so the UI is unaffected).
- **Done when:** a simulated 403 (temporarily point at a bad URL or throw) is reported as blocked with no retries.

---

## Phase 4 — Edges

### T4.1 API server ([src/api.ts](../../src/api.ts))
- **Depends on:** T3.7
- **Steps:**
  1. `/api/estimate` catch: map `DiscogsError.kind` → `blocked` ⇒ HTTP 503 `{ error, blocked: true }`; `rateLimited` ⇒ 429; else 500.
  2. Keep all input validation. `seller` stays a string (username).
  3. On shutdown, call `closeBrowser()`.
- **Done when:** responses carry the right status and flag.

### T4.2 Country filter ([src/lib/countryFilter.ts](../../src/lib/countryFilter.ts))
- **Depends on:** T2.3
- **Steps:** keep the import path `discogs-marketplace-api-nodejs/dist/data/country.data.js` (still exists). Keep or remove the table repair per D4. Update the header comment to describe the new library's behaviour.
- **Done when:** US/GB/DE filters return only matching countries.

### T4.3 CLI ([src/cli.ts](../../src/cli.ts), [src/exportStyle.ts](../../src/exportStyle.ts))
- **Depends on:** T3.6
- **Steps:** call `closeBrowser()` after the export loop (in `finally`), so the process exits. Update `--seller` help text if needed. Mention in `--sort` help that `label`/`catno` are not supported by Discogs anymore.
- **Done when:** `npm run export:style -- ...` finishes and returns to the prompt.

### T4.4 Web error text ([web/src/App.tsx](../../web/src/App.tsx))
- **Depends on:** T4.1
- **Steps:** the only UI change:
  - `blocked` → "Discogs is blocking automated searches right now. This is not a rate limit, so retrying won't help."
  - `429` → keep the current rate-limit message.
  - Optionally surface a `blocked` progress event the same way.
- **Done when:** each case shows its own message.

---

## Phase 5 — Verify
Details and checklists in [04-verification.md](04-verification.md).

- **T5.1** Write and run `scripts/smoke-marketplace.ts` (kept in the repo).
- **T5.2** Run the manual UI test matrix.
- **T5.3** Compare CSV columns with the T0.2 reference (web export and CLI).
- **T5.4** Soak: one full "fetch all" of a ~20-page search; watch memory, errors, pacing.

---

## Phase 6 — Finish

### T6.1 Docs
- [README.md](../../README.md): add the Chromium prerequisite (`npx patchright install --with-deps chromium`), explain that the app scrapes the marketplace from a headless browser, and remove wording about "the Discogs API" where it's inaccurate.
- [HEALTH_CHECK.md](../../HEALTH_CHECK.md) / [examples.md](../../examples.md): update any `label`/`catno` sort examples.
- Tick the tracker in this folder's [README](README.md#progress-tracker) and fill in the experiment log.

### T6.2 Cleanup
- Delete `scripts/spike-shop-api.ts`.
- Remove unused imports and helpers (`extractYear` only if the fallback isn't needed).
- Check that no `api: 'legacy'` or `page:` params are left.

### T6.3 Commit and merge
- One commit per phase is fine. Merge to `main` after T5 is green.

---

## Phase 7 — Later

### T7.1 Switch to the npm release
- **Trigger:** `npm view discogs-marketplace-api-nodejs version` shows a version newer than `1.16.9` (likely `2.0.0`).
- **Steps:** read its changelog and diff against `05c683a`, `npm install discogs-marketplace-api-nodejs@^2`, rerun T5.1, then remove `vendor/` if used.

---

## Follow-ups
Not part of this migration. Each becomes easy once it's done:
1. **Multi-seller search** (your three local shops at once): `sellers: string[]` → `sellerIds`, in the sidebar using the existing favourites list.
2. Multi-value format / condition / country pickers (mind the AND semantics for genre/format).
3. Price range and minimum seller rating filters.
4. New sorts: year, seller rating, ships from.
5. Show seller photos and "independent store" badge in the table.
