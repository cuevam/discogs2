# 05 — Risks, decisions, rollback

## Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Patchright also gets challenged from this machine or IP | Low–medium | Blocks the whole plan | Found at the T1.3 gate, before any real work. Try another network. If still blocked: fall back to the official-API seller mode (R1 fallback below). |
| R2 | Chromium won't run on WSL (missing libraries, sandbox) | Low | Blocks | `--with-deps`; the library already launches with `chromiumSandbox: false`. |
| R3 | Discogs/Cloudflare closes this workaround later | Medium over months | App breaks again | Pinned version plus clear "blocked" error. Watch the library repo; T7.1 path for updates. |
| R4 | ~~Unreleased commit changes before the npm release~~ | — | — | Closed: 1.17.0 on npm is identical to `05c683a`. |
| R5 | ~~`npm install` from git fails on `prepare`~~ | — | — | Closed: installed from npm. |
| R6 | Filter values differ on the new API and a filter silently matches nothing or everything | Medium | Wrong results | Style validation (T3.3), smoke asserts S6–S11, experiments T2.2–T2.4. |
| R7 | 3 requests per page trip a new Discogs rate limit | Low–medium | 429s on long searches | T2.5 measurement; D2; 429 is retried with backoff. |
| R8 | Headless Chromium memory use in a long-running dev server | Low | Laptop slowdown | One shared browser, context per call (library), optional idle close (T3.1), soak test T5.4. |
| R9 | Terms of use: bypassing Cloudflare goes against Discogs' terms | Certain (by design) | Account/IP action is possible but unlikely for personal low-volume use | Keep the conservative limiter; personal use only; don't publish or share the tool. **Owner's call.** |

### R1 fallback: official-API seller mode
If the browser route can't work, the three local sellers can still be served by
`api.discogs.com/users/{name}/inventory` (official, works today, 25/min
unauthenticated, 60/min with a personal token). Text/format/condition filters would
be applied on our side after fetching. Marketplace-wide search would stay unavailable.
Plan that as a separate task set if needed.

## Open decisions

Recommendations in **bold**. Confirm before or during Phase 3.

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Install source until npm release | git SHA / local tarball / wait | **Git SHA now**, tarball if `prepare` fails; move to npm in T7.1. |
| D2 | Limiter budget with 3 requests per page | keep 1 page / 3 s / slow to 1 page / 5 s / count 3 requests per page | **Keep 1 page / 3 s** unless T2.5 shows 429s, then 1 page / 5 s. |
| D3 | Sort `label,*` and `catno,*` (no longer supported) | fall back to `listed,desc` and warn / remove from the dropdown / sort on our side after fetching | **Fall back and warn** for now, so the UI stays the same. The results table's own column sorting still orders by label/cat#. Remove the options in a follow-up. |
| D4 | Country table repair in `countryFilter.ts` | keep / remove | **Decide from T2.3.** Keep if it fixes US/GB, remove if unneeded. |
| D5 | `showUnavailable` | library default `true` / `false` | **`false` if T2.5 shows unavailable items**, since you only want buyable listings. |
| D6 | `MAX_PAGES` | 400 / measured cap | **Measured value from T2.1.** |

## Rollback

- All work is on `migrate/shop-api-patchright`. `main` stays untouched until T6.3.
- The pre-migration app can't search while the Cloudflare block holds, so rolling back
  only helps if Discogs relaxes the block. To go back: `git checkout main`,
  `npm install discogs-marketplace-api-nodejs@1.14.4`.
- Chromium can be removed with `npx patchright uninstall`, or by deleting the browser
  cache folder that `npx patchright install` printed (usually under `~/.cache/`).
