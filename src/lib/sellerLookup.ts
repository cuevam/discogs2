/**
 * Seller username -> numeric Discogs user ID.
 *
 * The shop API filters by seller ID, while users type usernames. The official
 * REST API (api.discogs.com, not behind the Cloudflare challenge) resolves one
 * to the other. It has its own rate budget (25/min unauthenticated) and we call
 * it at most once per seller per process, so it doesn't go through the
 * marketplace limiter.
 */

import { DiscogsError } from './discogsError';

const idByUsername = new Map<string, number>();

export async function resolveSellerId(username: string): Promise<number> {
  const name = username.trim();
  const key = name.toLowerCase();
  const cached = idByUsername.get(key);
  if (cached !== undefined) return cached;

  const response = await fetch(`https://api.discogs.com/users/${encodeURIComponent(name)}`, {
    headers: { 'User-Agent': 'DiscogsMassExport/1.0' },
  });
  if (response.status === 404) {
    throw new DiscogsError('invalidInput', `Unknown Discogs seller "${name}".`);
  }
  if (!response.ok) {
    throw new DiscogsError(
      response.status === 429 ? 'rateLimited' : 'other',
      `Couldn't look up seller "${name}" (HTTP ${response.status}).`
    );
  }

  const { id } = (await response.json()) as { id?: number };
  if (typeof id !== 'number') {
    throw new DiscogsError('other', `Discogs returned no ID for seller "${name}".`);
  }
  idByUsername.set(key, id);
  return id;
}
