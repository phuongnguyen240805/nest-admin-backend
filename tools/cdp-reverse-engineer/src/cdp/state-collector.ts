import type { Page } from 'playwright';
import type { ServicePattern, StateSnapshot } from '../types.js';

const BROWSER_STATE_SCRIPT = `
(keys) => {
  const readStorage = (store) => {
    const out = {};
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k) out[k] = store.getItem(k) ?? '';
    }
    return out;
  };

  const globals = {};
  for (const key of keys) {
    if (key in window) {
      try {
        const v = window[key];
        globals[key] =
          typeof v === 'object' && v !== null
            ? JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === 'function' ? '[Function]' : val)))
            : v;
      } catch {
        globals[key] = '[unserializable]';
      }
    }
  }

  const redux = window.__REDUX_DEVTOOLS_EXTENSION__
    ? '[redux-devtools-present]'
    : window.__store ?? undefined;

  const zustandCandidates = {};
  for (const [k, v] of Object.entries(window)) {
    if (/zustand|store/i.test(k) && typeof v === 'object') {
      zustandCandidates[k] = '[detected]';
    }
  }

  return {
    localStorage: readStorage(localStorage),
    sessionStorage: readStorage(sessionStorage),
    globals,
    redux,
    zustand: Object.keys(zustandCandidates).length ? zustandCandidates : undefined,
  };
}
`;

const BROWSER_INDEXEDDB_SCRIPT = `async () => {
  if (!('indexedDB' in window)) return [];
  const dbs = await indexedDB.databases?.();
  return (dbs ?? []).map((d) => d.name ?? 'unknown');
}`;

const BROWSER_SW_SCRIPT = `async () => {
  if (!('serviceWorker' in navigator)) return [];
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.map((r) => r.scope);
  } catch {
    return [];
  }
}`;

const BROWSER_UA_SCRIPT = `() => navigator.userAgent`;

export async function collectState(
  page: Page,
  patterns: ServicePattern[],
): Promise<StateSnapshot> {
  const globalKeys = [...new Set(patterns.flatMap((p) => p.globalKeys ?? []))];

  const snapshot = await page.evaluate(
    new Function('return (' + BROWSER_STATE_SCRIPT + ')')() as (keys: string[]) => {
      localStorage: Record<string, string>;
      sessionStorage: Record<string, string>;
      globals: Record<string, unknown>;
      redux?: unknown;
      zustand?: unknown;
    },
    globalKeys,
  );

  const cookies = await page.context().cookies();
  const indexedDB = await page.evaluate(
    new Function('return (' + BROWSER_INDEXEDDB_SCRIPT + ')')() as () => Promise<string[]>,
  );
  const serviceWorkers = await page.evaluate(
    new Function('return (' + BROWSER_SW_SCRIPT + ')')() as () => Promise<string[]>,
  );

  return {
    ...snapshot,
    cookies: cookies.map((c) => ({
      name: c.name,
      domain: c.domain,
      path: c.path,
      value: c.value,
    })),
    indexedDB,
    serviceWorkers,
  };
}

export async function readUserAgent(page: Page): Promise<string> {
  return page.evaluate(new Function('return (' + BROWSER_UA_SCRIPT + ')')() as () => string);
}