/**
 * One shared headless Chromium for every marketplace request.
 *
 * The marketplace library runs each search from a Patchright browser (Discogs'
 * Cloudflare rejects plain HTTP clients). Launching Chromium takes a second or
 * two, so we launch it lazily on first use, reuse it across searches (the
 * library opens and closes its own context per call), and close it after a
 * period of inactivity or when the process exits.
 */

import { chromium, Browser } from 'patchright';

/** Close the browser after this long without a search, to free memory. */
const IDLE_CLOSE_MS = 5 * 60_000;

let browserPromise: Promise<Browser> | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let shutdownHooksInstalled = false;

function scheduleIdleClose(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log('[BROWSER] Idle, closing Chromium');
    void closeBrowser();
  }, IDLE_CLOSE_MS);
  // Never keep the process alive just for this timer.
  idleTimer.unref();
}

function installShutdownHooks(): void {
  if (shutdownHooksInstalled) return;
  shutdownHooksInstalled = true;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      closeBrowser().finally(() => process.exit(0));
    });
  }
}

/**
 * Get the shared browser, launching it if needed (or relaunching it if it
 * crashed). Concurrent first calls share one launch.
 */
export async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    if (browser?.isConnected()) {
      scheduleIdleClose();
      return browser;
    }
    browserPromise = null;
  }

  installShutdownHooks();
  console.log('[BROWSER] Launching headless Chromium');
  browserPromise = chromium.launch({ headless: true, chromiumSandbox: false });
  try {
    const browser = await browserPromise;
    browser.on('disconnected', () => {
      browserPromise = null;
    });
    scheduleIdleClose();
    return browser;
  } catch (error) {
    browserPromise = null;
    throw error;
  }
}

/** Close the shared browser if it is open. Safe to call more than once. */
export async function closeBrowser(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const pending = browserPromise;
  browserPromise = null;
  if (!pending) return;
  const browser = await pending.catch(() => null);
  await browser?.close().catch(() => undefined);
}
