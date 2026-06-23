import type { ApiEntry, ServiceHit, ServicePattern, StateSnapshot, WebSocketEntry } from '../types.js';

export function analyzeServices(
  patterns: ServicePattern[],
  apis: ApiEntry[],
  websockets: WebSocketEntry[],
  state: StateSnapshot,
): ServiceHit[] {
  return patterns.map((pattern) => {
    const urlKeys = pattern.urlIncludes.map((k) => k.toLowerCase());
    const wsKeys = (pattern.wsIncludes ?? []).map((k) => k.toLowerCase());
    const globalKeys = (pattern.globalKeys ?? []).map((k) => k.toLowerCase());

    const matchedApis = apis
      .filter((a) => {
        const hay = `${a.url} ${a.host} ${a.path}`.toLowerCase();
        return urlKeys.some((k) => hay.includes(k)) || a.service === pattern.name;
      })
      .map((a) => `${a.method} ${a.path}`);

    const matchedWs = websockets
      .filter((w) => {
        const hay = w.url.toLowerCase();
        return wsKeys.some((k) => hay.includes(k)) || w.service === pattern.name;
      })
      .map((w) => w.url);

    const matchedGlobals = Object.keys(state.globals).filter((k) =>
      globalKeys.includes(k.toLowerCase()),
    );

    const storageKeys = [
      ...Object.keys(state.localStorage),
      ...Object.keys(state.sessionStorage),
    ].filter((k) => urlKeys.some((p) => k.toLowerCase().includes(p)));

    return {
      name: pattern.name,
      apis: [...new Set(matchedApis)],
      websockets: [...new Set(matchedWs)],
      globals: matchedGlobals,
      storageKeys: [...new Set(storageKeys)],
    };
  });
}