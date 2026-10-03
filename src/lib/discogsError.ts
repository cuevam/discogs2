/**
 * Typed errors for marketplace requests, so callers can react to the kind of
 * failure without grepping message strings.
 *
 *  - `blocked`:     Cloudflare challenged the request (HTTP 403). Retrying or
 *                   waiting doesn't help, so it is never retried.
 *  - `rateLimited`: Discogs asked us to slow down (HTTP 429). Retried with backoff.
 *  - `network`:     Browser timeout or navigation failure. Retried with backoff.
 *  - `invalidInput`: A filter we can't send faithfully (unknown seller/style).
 *  - `other`:       Anything else.
 */

export type DiscogsErrorKind = 'blocked' | 'rateLimited' | 'network' | 'invalidInput' | 'other';

export class DiscogsError extends Error {
  readonly kind: DiscogsErrorKind;
  /** The original error, kept for logging. */
  readonly cause?: unknown;

  constructor(kind: DiscogsErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'DiscogsError';
    this.kind = kind;
    this.cause = cause;
  }
}

/** Wrap any error thrown by the marketplace library in a DiscogsError. */
export function classifyError(error: unknown): DiscogsError {
  if (error instanceof DiscogsError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';

  if (/\b403\b|just a moment|challenge/i.test(message)) {
    return new DiscogsError(
      'blocked',
      'Discogs is blocking automated searches right now (HTTP 403). This is not a rate limit, so retrying won\'t help.',
      error
    );
  }
  if (/\b429\b/.test(message)) {
    return new DiscogsError('rateLimited', 'Discogs is rate-limiting right now (HTTP 429).', error);
  }
  if (name === 'TimeoutError' || /net::ERR_|Timeout|Target .* closed|Browser has been closed/i.test(message)) {
    return new DiscogsError('network', `Network error talking to Discogs: ${message}`, error);
  }
  return new DiscogsError('other', message, error);
}
