# Migration: Discogs shop API + Patchright

Move the app off the dead `sell/list` scraper and onto the new version of
`discogs-marketplace-api-nodejs`, **without changing how the UI works**.

| | |
|---|---|
| **Status** | Planned — not started |
| **Written** | 2026-09-28 |
| **Branch** | `migrate/shop-api-patchright` |
| **Library target** | `KirianCaumes/Discogs-Marketplace-API-NodeJS` @ `05c683a` (unreleased; move to the npm release when it ships) |
| **Estimated effort** | ~1 working day, most of it verification |

## Why

Since late September 2026 every marketplace search fails with `403`. It is not
rate limiting: Discogs' Cloudflare now challenges any non-browser request to
`www.discogs.com/sell/list` (`cf-mitigated: challenge`, "Just a moment..."), from
the very first request. The installed library (`1.14.4`, legacy mode) can't pass
it. The library author shipped a rewrite the same day that runs searches from a
headless Chromium (Patchright) against the new shop GraphQL API.
Full evidence: [01-findings.md](01-findings.md).

## Goal and non-goals

**Goal:** searches, estimates, streaming, CSV export and the CLI work again, with
the same UI, the same `SearchOptions` input and the same `ListingData` output.

**In scope**
- Swap the library and rewrite [src/lib/exporter.ts](../../src/lib/exporter.ts) against it.
- Seller username → seller ID lookup (the new API filters by ID).
- A shared, reusable headless browser.
- Correct error reporting (Cloudflare block ≠ rate limit).
- Validation so no filter can be silently dropped.

**Out of scope (follow-ups, see [03-tasks.md § Follow-ups](03-tasks.md#follow-ups))**
- Multi-seller search, multi-value filters, price range, new sort options.
- Any UI redesign.

## Documents

| File | What it is for |
|---|---|
| [01-findings.md](01-findings.md) | Root cause, evidence, what the new library does and how it differs. |
| [02-mapping-reference.md](02-mapping-reference.md) | Field-by-field mapping: our `SearchOptions` → new `SearchParams`, new result → our `ListingData`. The reference while coding. |
| [03-tasks.md](03-tasks.md) | Every task in execution order, with files, steps and acceptance criteria. |
| [04-verification.md](04-verification.md) | Smoke script, manual UI test matrix, and the experiments that settle open questions. |
| [05-risks-and-rollback.md](05-risks-and-rollback.md) | Risks, decisions still open, and how to back out. |

## Order of execution

Phases run in order; tasks inside a phase run in the order listed.
**Gate** = stop and check before continuing.

| # | Phase | Tasks | Gate |
|---|---|---|---|
| 0 | Prepare | T0.1 branch · T0.2 baseline | Old build still compiles on the branch. |
| 1 | Install | T1.1 library · T1.2 Chromium · T1.3 spike script | **Spike returns real listings from WSL.** If not, stop — see [risks R1/R2](05-risks-and-rollback.md). |
| 2 | Experiments | T2.1–T2.5 (page cap, styles, countries, conditions, request cost) | Results written into [04-verification.md § Experiment log](04-verification.md#experiment-log). |
| 3 | Core rewrite | T3.1 browser manager · T3.2 seller lookup · T3.3 params builder · T3.4 item mapper · T3.5 estimate · T3.6 search loop · T3.7 errors | `npm run build` passes. |
| 4 | Edges | T4.1 API server · T4.2 country filter · T4.3 CLI · T4.4 web error text | `npm run build` + `web` type-check pass. |
| 5 | Verify | T5.1 smoke script · T5.2 UI matrix · T5.3 CSV · T5.4 soak | Everything in [04-verification.md](04-verification.md) green. |
| 6 | Finish | T6.1 docs · T6.2 cleanup · T6.3 commit/merge | — |
| 7 | Later | T7.1 switch to npm release | When the new version is published. |

## Progress tracker

Tick as you go.

- [ ] **Phase 0** — T0.1 · T0.2
- [ ] **Phase 1** — T1.1 · T1.2 · T1.3 · **gate passed**
- [ ] **Phase 2** — T2.1 · T2.2 · T2.3 · T2.4 · T2.5
- [ ] **Phase 3** — T3.1 · T3.2 · T3.3 · T3.4 · T3.5 · T3.6 · T3.7
- [ ] **Phase 4** — T4.1 · T4.2 · T4.3 · T4.4
- [ ] **Phase 5** — T5.1 · T5.2 · T5.3 · T5.4
- [ ] **Phase 6** — T6.1 · T6.2 · T6.3
- [ ] **Phase 7** — T7.1

## Definition of done

1. The search from the failing log (`artist: "oren ambarchi"`, `format: Vinyl`,
   `sort: price,asc`) returns listings in the UI, with estimate, streaming and progress.
2. A seller search for `endofanear`, `Waterloorecords` and `breakawayrecords`
   returns only that seller's listings.
3. Every filter in the sidebar either narrows results correctly or fails with a
   clear message. None is silently ignored.
4. A Cloudflare block shows a "blocked" message, not "rate-limiting", and is not retried.
5. CSV export from the web and from the CLI has the same columns as before.
6. The CLI exits on its own when it finishes (no Chromium left running).
