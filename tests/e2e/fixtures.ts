import { test as base, expect, type APIRequestContext, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DatePriceSnapshotSchema, SearchRecoverySchema, SessionInfoSchema, TransportSearchQuerySchema,
  type CreateDemoSessionInput, type DatePriceSnapshot, type Mode, type Scope,
  type SearchRecovery, type SessionInfo, type TransportSearchQuery, type TripType,
} from '@torob-ticket/contracts';

export { expect };
export const DEFAULT_SEED = 3030;
export const DEFAULT_ANCHOR = '2026-10-29T06:00:00Z';
export const SINGLE_ADULT = { adults: 1, children: 0, infants: 0 } as const;
export const TERMINAL_SEARCH = /^(complete|partial|empty|failed|cancelled|interrupted)$/;

export interface OwnedReviewer {
  context: BrowserContext;
  page: Page;
  session: SessionInfo;
}

export interface ReviewerOptions extends CreateDemoSessionInput {
  viewport?: { width: number; height: number };
  reducedMotion?: 'reduce' | 'no-preference';
  hasTouch?: boolean;
  isMobile?: boolean;
}

type ReviewerFactory = (options?: ReviewerOptions) => Promise<OwnedReviewer>;
interface OwnedNamespace {
  context: BrowserContext;
  index: number;
  bootstrap?: Promise<OwnedReviewer>;
  cleanup?: Promise<string[]>;
}

// Playwright request errors can include Cookie headers in their message/call log.
// Teardown diagnostics use only fixed labels, never the caught error or its message.
function safeFailure(error: unknown): string {
  return error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'failed';
}
async function bounded<T>(operation: Promise<T>, milliseconds: number, retireLate?: (value: T) => Promise<unknown>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const observed = operation.then(value => {
    // A timeout does not cancel asynchronous resource creation. Keep observing
    // its result and dispose it even after its caller has already moved on.
    if (expired && retireLate) void Promise.resolve().then(() => retireLate(value)).catch(() => undefined);
    return value;
  });
  try {
    return await Promise.race([observed, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        expired = true;
        const error = new Error('owned-operation-deadline'); error.name = 'TimeoutError'; reject(error);
      }, milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

async function capturePublicFailure(info: TestInfo, context: BrowserContext, index: number): Promise<void> {
  const pages = context.pages();
  await Promise.all(pages.map(async (page, pageIndex) => {
    // API-only reviewers have no product DOM to diagnose or screenshot.
    if (page.isClosed() || page.url().startsWith('about:blank')) return;
    const stem = `owned-reviewer-${index + 1}-page-${pageIndex + 1}-failure`;
    try {
      // Only rendered product facts: no HTML scripts, storage, cookies, request data or headers.
      const publicDom = await bounded(page.evaluate(() => ({
        pathname: location.pathname,
        title: document.title,
        text: document.body.innerText.slice(0, 24_000),
        results: Array.from(document.querySelectorAll('[data-search-id]')).map(node => ({
          searchId: node.getAttribute('data-search-id'), status: node.getAttribute('data-status'),
        })),
        dates: Array.from(document.querySelectorAll('[data-date-price-status]')).map(node => ({
          status: node.getAttribute('data-date-price-status'), leg: node.getAttribute('data-date-leg'),
          outbound: node.getAttribute('data-selected-outbound'), return: node.getAttribute('data-selected-return'),
        })),
      })), 5000);
      writeFileSync(info.outputPath(stem + '.json'), JSON.stringify(publicDom, null, 2) + '\n');
    } catch { /* Failure diagnostics must never replace the primary failure or expose errors. */ }
    try {
      const path = info.outputPath(stem + '.png');
      await page.screenshot({ path, fullPage: false, timeout: 5000 });
      await bounded(info.attach(stem, { path, contentType: 'image/png' }), 5000);
    } catch { /* A timed-out/closed page may not be capturable. */ }
  }));
}

/** Every mutable context is newly owned here; the user's browser/session is never acquired. */
export const test = base.extend<{ reviewer: OwnedReviewer; newReviewer: ReviewerFactory }>({
  newReviewer: [async ({ browser, baseURL, playwright }, use, info) => {
    if (!baseURL) throw new Error('T30 acceptance requires an explicit same-origin baseURL');
    const owned: OwnedNamespace[] = [];
    let accepting = true;
    const cleanupNamespace = (namespace: OwnedNamespace): Promise<string[]> => {
      if (namespace.cleanup) return namespace.cleanup;
      namespace.cleanup = (async () => {
        const failures: string[] = [], { context, index } = namespace;
        const label = `owned reviewer ${index + 1}`;
        let cleanup: APIRequestContext | undefined;
        try {
          // A bootstrap may still be settling when its test times out. Let its
          // bounded request publish any received cookie before reading this jar.
          if (namespace.bootstrap) {
            try { await bounded(namespace.bootstrap.then(() => undefined, () => undefined), 20_000); }
            catch (error) { failures.push(`${label} bootstrap settlement ${safeFailure(error)}`); }
          }
          try {
            const storageState = await bounded(context.storageState(), 5000);
            // No session was acquired if bootstrap failed before receiving its
            // cookie. Never call reset with an empty or unrelated cookie jar.
            if (storageState.cookies.some(cookie => cookie.name === 'torob_demo')) {
              cleanup = await bounded(playwright.request.newContext({ baseURL, storageState, timeout: 5000 }), 5000,
                late => bounded(late.dispose(), 5000));
            }
          } catch (error) { failures.push(`${label} cleanup client ${safeFailure(error)}`); }
          // Page closure is concurrent inside this one owned namespace, so one
          // stalled page cannot consume the budget of every other owned page.
          await Promise.all(context.pages().map(async page => {
            try { await bounded(page.close(), 5000); }
            catch (error) { failures.push(`${label} page close ${safeFailure(error)}`); }
          }));
          if (cleanup) {
            try {
              const response = await cleanup.post('/api/v1/demo/reset', { data: {}, timeout: 5000 });
              if (response.status() !== 201) failures.push(`${label} reset status ${response.status()}`);
              else SessionInfoSchema.parse(await response.json());
            } catch (error) { failures.push(`${label} namespace reset ${safeFailure(error)}`); }
          }
        } catch (error) { failures.push(`${label} cleanup ${safeFailure(error)}`); }
        finally {
          if (cleanup) {
            try { await bounded(cleanup.dispose(), 5000); }
            catch (error) { failures.push(`${label} cleanup dispose ${safeFailure(error)}`); }
          }
          try { await bounded(context.close(), 5000); }
          catch (error) { failures.push(`${label} context close ${safeFailure(error)}`); }
        }
        return failures;
      })();
      return namespace.cleanup;
    };
    const create: ReviewerFactory = async (options = {}) => {
      let namespace: OwnedNamespace | undefined;
      try {
        if (!accepting) throw new Error('owned-reviewer-lifetime-ended');
        const registered: OwnedNamespace = await bounded<OwnedNamespace>(browser.newContext({
          baseURL,
          viewport: options.viewport ?? { width: 1366, height: 900 },
          reducedMotion: options.reducedMotion ?? 'reduce',
          ...(options.hasTouch === undefined ? {} : { hasTouch: options.hasTouch }),
          ...(options.isMobile === undefined ? {} : { isMobile: options.isMobile }),
        }).then(context => {
          // Register immediately, including a late creation or failed bootstrap.
          const value: OwnedNamespace = { context, index: owned.length }; owned.push(value); return value;
        }), 10_000, late => cleanupNamespace(late).then(() => undefined));
        namespace = registered;
        const { context } = registered;
        context.setDefaultTimeout(10_000); context.setDefaultNavigationTimeout(30_000);
        const bootstrap: Promise<OwnedReviewer> = (async () => {
          if (!accepting) throw new Error('owned-reviewer-lifetime-ended');
          // Inspect only the count: assertion output must never contain cookie values.
          expect((await bounded(context.cookies(), 5000)).length).toBe(0);
          if (!accepting) throw new Error('owned-reviewer-lifetime-ended');
          const response = await context.request.post('/api/v1/demo/session', {
            timeout: 10_000,
            data: { seed: options.seed ?? DEFAULT_SEED, anchorInstant: options.anchorInstant ?? DEFAULT_ANCHOR, scenario: options.scenario ?? 'normal' },
          });
          expect(response.status()).toBe(201);
          const session = SessionInfoSchema.parse(await bounded(response.json(), 5000));
          if (!accepting) throw new Error('owned-reviewer-lifetime-ended');
          const page = await bounded(context.newPage(), 10_000, late => bounded(late.close(), 5000));
          if (!accepting) { await bounded(page.close(), 5000); throw new Error('owned-reviewer-lifetime-ended'); }
          return { context, page, session };
        })();
        registered.bootstrap = bootstrap;
        return await bootstrap;
      } catch (error) {
        if (namespace) await cleanupNamespace(namespace);
        throw new Error(`Owned reviewer setup ${safeFailure(error)}`);
      }
    };
    try {
      await use(create);
    } finally {
      accepting = false;
      // Namespaces have independent cookie jars and no shared mutable state.
      // Concurrent bounded cleanup gives every owner its own teardown budget;
      // nine API reviewers cannot starve the later entries behind one timeout.
      const failures = (await Promise.all(owned.map(async namespace => {
        if (info.status !== info.expectedStatus && !namespace.cleanup) {
          try { await capturePublicFailure(info, namespace.context, namespace.index); }
          catch { /* Public capture must not prevent any owned cleanup. */ }
        }
        return cleanupNamespace(namespace);
      }))).flat();
      expect(failures, 'Every newly owned T30 namespace must be reset and closed').toEqual([]);
    }
  }, { timeout: 120_000 }],
  reviewer: async ({ newReviewer }, use) => { await use(await newReviewer()); },
});

export const resultRegion = (page: Page) => page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
export const dateExplorer = (page: Page) => page.getByRole('region', { name: 'کاوش تاریخ سفر', exact: true });
export const priceCards = (page: Page) => resultRegion(page).locator('article[data-price-card-id][data-quote-id]');

export function queryFor(mode: Mode = 'flight', scope: Scope = 'domestic', tripType: TripType = 'one-way', patch: Partial<TransportSearchQuery> = {}): TransportSearchQuery {
  const destinationCityId = scope === 'domestic'
    ? mode === 'bus' ? 'isfahan' : 'mashhad'
    : mode === 'flight' ? 'istanbul' : mode === 'train' ? 'van' : 'yerevan';
  return TransportSearchQuerySchema.parse({
    mode, scope, tripType, originCityId: 'tehran', destinationCityId,
    departureDate: '2026-11-02', ...(tripType === 'round-trip' ? { returnDate: '2026-11-09' } : {}),
    party: { ...SINGLE_ADULT }, classCode: mode === 'flight' ? 'economy' : mode === 'train' ? 'seat' : 'standard',
    filters: {}, sort: 'cheapest', ...patch,
  });
}

export async function resetReviewer(reviewer: OwnedReviewer, input: CreateDemoSessionInput = {}): Promise<SessionInfo> {
  const response = await reviewer.context.request.post('/api/v1/demo/reset', { data: input });
  expect(response.status()).toBe(201);
  reviewer.session = SessionInfoSchema.parse(await response.json());
  return reviewer.session;
}

export async function loadQuery(reviewer: OwnedReviewer, query: TransportSearchQuery): Promise<void> {
  await reviewer.page.goto('/?' + new URLSearchParams({ q: JSON.stringify(TransportSearchQuerySchema.parse(query)) }));
  await expect(reviewer.page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await expect(dateExplorer(reviewer.page)).toHaveAttribute('data-date-price-status', 'complete', { timeout: 30_000 });
}

export async function readSearch(reviewer: OwnedReviewer, searchId: string): Promise<SearchRecovery> {
  const response = await reviewer.context.request.get('/api/v1/searches/' + encodeURIComponent(searchId));
  expect(response.status()).toBe(200);
  return SearchRecoverySchema.parse(await response.json());
}

export async function waitForSearch(reviewer: OwnedReviewer, searchId: string): Promise<SearchRecovery> {
  let recovery: SearchRecovery | undefined;
  await expect.poll(async () => {
    recovery = await readSearch(reviewer, searchId);
    return recovery.snapshot.status;
  }, { timeout: 30_000, intervals: [100, 250, 500] }).toMatch(TERMINAL_SEARCH);
  return recovery!;
}

export async function runSearch(reviewer: OwnedReviewer, action?: () => Promise<unknown>): Promise<SearchRecovery> {
  const page = reviewer.page;
  const pending = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/searches');
  await (action ? action() : page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click());
  const response = await pending;
  expect(response.status()).toBe(201);
  const initial = SearchRecoverySchema.parse(await response.json());
  await expect(resultRegion(page)).toHaveAttribute('data-search-id', initial.snapshot.searchId);
  await expect(resultRegion(page)).toHaveAttribute('data-status', TERMINAL_SEARCH, { timeout: 30_000 });
  return waitForSearch(reviewer, initial.snapshot.searchId);
}

export async function startApiSearch(reviewer: OwnedReviewer, query: TransportSearchQuery, clientGeneration = 't30-' + randomUUID()): Promise<SearchRecovery> {
  const response = await reviewer.context.request.post('/api/v1/searches', { data: { query: TransportSearchQuerySchema.parse(query), clientGeneration } });
  expect(response.status()).toBe(201);
  const initial = SearchRecoverySchema.parse(await response.json());
  return waitForSearch(reviewer, initial.snapshot.searchId);
}

export async function readDatePrices(reviewer: OwnedReviewer, datePriceId: string, clientGeneration: string): Promise<DatePriceSnapshot> {
  const response = await reviewer.context.request.get('/api/v1/date-prices/' + encodeURIComponent(datePriceId), { params: { clientGeneration } });
  expect(response.status()).toBe(200);
  return DatePriceSnapshotSchema.parse(await response.json());
}

export async function currentDatePrices(reviewer: OwnedReviewer): Promise<DatePriceSnapshot> {
  await expect(dateExplorer(reviewer.page)).toHaveAttribute('data-date-price-status', 'complete', { timeout: 30_000 });
  const id = await dateExplorer(reviewer.page).getAttribute('data-date-price-id');
  expect(id).toBeTruthy();
  // A new polling view reads the existing owned batch; it does not create a different price intent.
  return readDatePrices(reviewer, id!, 't30-observe-' + randomUUID());
}

export function writeEvidence(info: TestInfo, name: string, value: unknown): void {
  const directory = process.env.T30_EVIDENCE_DIR ?? resolve(process.env.E2E_EVIDENCE_DIR ?? 'docs/evidence/T30/resume-2026-11-01/native', 'acceptance');
  const caseName = info.titlePath.join('-').replace(/[^a-z0-9]+/gi, '-').slice(-150);
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, `${caseName}-${name}.json`), JSON.stringify(value, null, 2) + '\n');
}
