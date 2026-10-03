/**
 * Sliding-window rate limiter.
 *
 * Context: one user "search" fans out into many HTTP requests to Discogs — one
 * per result page (up to 400 pages of 250 items). Discogs' documented allowance
 * for unauthenticated access is 25 requests per rolling 60s window. This limiter
 * paces those per-page requests so a search complies with that budget instead of
 * bursting and getting throttled (403/429).
 *
 * It enforces a hard mathematical invariant: at any instant, the number of
 * requests that started within the trailing `windowMs` never exceeds
 * `effectiveMax`. On top of that cap it also spaces consecutive requests evenly
 * (windowMs / effectiveMax apart) so the allowance is spent smoothly rather than
 * in a burst followed by a long stall.
 */

export interface RateLimiterOptions {
  /** Documented requests permitted within each rolling window (e.g. 25). */
  maxRequests?: number;
  /** Length of the rolling window in milliseconds (e.g. 60000). */
  windowMs?: number;
  /**
   * Fraction of the raw budget we actually use (0 < f <= 1). 0.8 means we aim
   * for 80% of the documented limit, leaving 20% headroom for jitter/retries.
   */
  safetyFactor?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RateLimiter {
  /** Requests we actually allow per window (documented budget * safetyFactor). */
  readonly effectiveMax: number;
  readonly windowMs: number;
  /** Even spacing between consecutive requests: windowMs / effectiveMax. */
  readonly minIntervalMs: number;

  /** Start times (ms epoch) of requests still inside the trailing window. */
  private history: number[] = [];
  /** Serializes acquire() calls so concurrent callers queue deterministically. */
  private chain: Promise<void> = Promise.resolve();

  constructor(options: RateLimiterOptions = {}) {
    const maxRequests = options.maxRequests ?? 25;
    const windowMs = options.windowMs ?? 60_000;
    const safetyFactor = options.safetyFactor ?? 0.8;

    if (maxRequests <= 0) throw new Error('maxRequests must be > 0');
    if (windowMs <= 0) throw new Error('windowMs must be > 0');
    if (safetyFactor <= 0 || safetyFactor > 1) {
      throw new Error('safetyFactor must be in (0, 1]');
    }

    this.effectiveMax = Math.max(1, Math.floor(maxRequests * safetyFactor));
    this.windowMs = windowMs;
    this.minIntervalMs = windowMs / this.effectiveMax;
  }

  /**
   * Estimate how long it takes to make `requestCount` requests under this
   * budget, assuming the limiter starts idle. Because requests are spaced
   * `minIntervalMs` apart, the wall-clock duration is (requestCount - 1) gaps.
   * Returns milliseconds (0 for <= 1 request). This is the number the UI shows.
   */
  estimateDurationMs(requestCount: number): number {
    if (requestCount <= 1) return 0;
    return Math.round((requestCount - 1) * this.minIntervalMs);
  }

  /** Human-readable summary of the enforced budget. */
  describe(): string {
    return `${this.effectiveMax} req / ${this.windowMs}ms ` +
      `(every ${Math.round(this.minIntervalMs)}ms)`;
  }

  /**
   * Resolves only once it is safe to issue the next request without violating
   * either the sliding-window cap or the minimum spacing. Calls are serialized,
   * so awaiting acquire() before each request yields a compliant, evenly-paced
   * schedule.
   */
  acquire(): Promise<void> {
    const result = this.chain.then(() => this.waitForSlot());
    // Keep the chain alive even if a waiter rejects (it never does here).
    this.chain = result.catch(() => undefined);
    return result;
  }

  private async waitForSlot(): Promise<void> {
    // Loop because after sleeping, wall-clock time has advanced and we must
    // re-evaluate the window before committing to a slot.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const now = Date.now();

      // Evict timestamps that have aged out of the trailing window.
      const cutoff = now - this.windowMs;
      this.history = this.history.filter((t) => t > cutoff);

      // Constraint 1: minimum spacing since the most recent request.
      const last = this.history.length
        ? this.history[this.history.length - 1]
        : -Infinity;
      const spacingWait = last + this.minIntervalMs - now;

      // Constraint 2: sliding-window cap. If the window is full, wait until the
      // oldest in-window request exits (oldest + windowMs).
      let windowWait = 0;
      if (this.history.length >= this.effectiveMax) {
        const oldest = this.history[0];
        windowWait = oldest + this.windowMs - now;
      }

      const wait = Math.max(spacingWait, windowWait, 0);
      if (wait <= 0) {
        // Slot granted: record the start time and proceed.
        this.history.push(now);
        return;
      }

      await sleep(wait);
    }
  }
}
