import type { ApiEntry, WebSocketEntry } from '../types.js';
import { buildNestJsHints } from './nestjs-exporter.js';
import { classifyRoute } from './schema-exporter.js';

const STATIC_RE = /\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|map)(\?|$)/i;
const SKIP_METHODS = new Set(['OPTIONS', 'HEAD']);
const NOISE_HOSTS =
  /google|yandex|facebook|doubleclick|hotjar|analytics|googletagmanager|clarity|linkedin|tiktok|twitter|bing|taboola|pinterest/i;

const LADI_HOSTS =
  /\.ladipage\.com$|^a\.ladipage\.com$|^api(v5)?\.ladipage|^api\.ladiuid|^apps\.ladipage|^build\.ladipage|^app\.ladipage|\.ldpform\.net$|^apiv5\.sales\.ldpform|\.ladiflow\.com$|^api\.lcrm/i;
const LADI_PATHS =
  /\/ladi-[-a-z/]+|\/api\/|\/1\.0\/(customer|segment|crm|report|dashboard|custom-field|sync)|\/2\.0\/(api-key|auth|workspace)\//i;

export function isLadipageApi(api: ApiEntry): boolean {
  if (api.url.startsWith('file:') || api.url.startsWith('data:')) return false;
  if (STATIC_RE.test(api.url)) return false;
  if (SKIP_METHODS.has(api.method)) return false;
  if (NOISE_HOSTS.test(api.host)) return false;

  const isCdnAsset = api.host.includes('ladicdn') && STATIC_RE.test(api.path);
  if (isCdnAsset) return false;

  return LADI_HOSTS.test(api.host) || LADI_PATHS.test(api.path) || api.path.includes('ladi-page');
}

export function isLadipageBackendApi(api: ApiEntry): boolean {
  if (!isLadipageApi(api)) return false;
  if (api.method !== 'POST') return false;
  if (api.host === 'app.ladipage.com' && api.path.startsWith('/ladipage-app-v6')) return false;
  if (api.host === 'w.ladicdn.com') return false;
  return true;
}

export interface LadipageEndpoint {
  method: string;
  host: string;
  path: string;
  url: string;
  status?: number;
  requestBody?: unknown;
  responseBody?: unknown;
  requestHeaders: Record<string, string>;
  timingMs?: number;
  timestamp: string;
}

export interface LadipageFlowExport {
  targetPath: string;
  finalUrl: string;
  pageTitle: string;
  postEndpoints: LadipageEndpoint[];
  allLadipageApis: LadipageEndpoint[];
  uniqueRoutes: string[];
  readRoutes: string[];
  mutationRoutes: string[];
  websockets: Array<{ url: string; frameCount: number; service?: string }>;
  nestjsHints: ReturnType<typeof buildNestJsHints>;
  rebuildNotes: string[];
}

export function buildLadipageFlow(
  apis: ApiEntry[],
  websockets: WebSocketEntry[],
  meta: { url: string; finalUrl: string; pageTitle: string },
): LadipageFlowExport {
  const ladipageApis = apis.filter(isLadipageApi);
  const backendPosts = apis.filter(isLadipageBackendApi);
  const toEndpoint = (a: ApiEntry): LadipageEndpoint => ({
    method: a.method,
    host: a.host,
    path: a.path,
    url: a.url,
    status: a.status,
    requestBody: a.requestBody,
    responseBody: a.responseBody,
    requestHeaders: a.requestHeaders,
    timingMs: a.timingMs,
    timestamp: a.timestamp,
  });

  const postEndpoints = backendPosts.map(toEndpoint);
  const uniqueRoutes = [...new Set(postEndpoints.map((e) => `${e.method} ${e.host}${e.path}`))].sort();
  const apiPath = (route: string) => {
    const idx20 = route.indexOf('/2.0/');
    if (idx20 >= 0) return route.slice(idx20);
    const idx10 = route.indexOf('/1.0/');
    if (idx10 >= 0) return route.slice(idx10);
    return route;
  };
  const readRoutes = uniqueRoutes.filter((r) => classifyRoute(apiPath(r)) === 'read');
  const mutationRoutes = uniqueRoutes.filter((r) => classifyRoute(apiPath(r)) === 'mutation');

  const notes: string[] = [];
  if (meta.finalUrl.includes('login') || meta.finalUrl.includes('signin') || meta.finalUrl.includes('auth')) {
    notes.push('Trang redirect về login — cần chạy --headed và đăng nhập thủ công để bắt full API flow.');
  }
  if (postEndpoints.length === 0) {
    notes.push('Không bắt được POST Ladipage — tăng --duration hoặc thêm actions click vào UI.');
  }
  if (postEndpoints.some((e) => e.path.includes('ladi-page'))) {
    notes.push('Đã bắt được ladi-page/* — dùng requestBody/responseBody để scaffold DTO NestJS.');
  }
  if (mutationRoutes.length === 0) {
    notes.push('Chưa có mutation route — chạy config *-mutations.json và submit form (fill + click Lưu/Tạo).');
  } else {
    notes.push(`Đã bắt ${mutationRoutes.length} mutation route(s) — xem mutationRoutes trong ladipage-flow.json.`);
  }

  return {
    targetPath: meta.url,
    finalUrl: meta.finalUrl,
    pageTitle: meta.pageTitle,
    postEndpoints,
    allLadipageApis: ladipageApis.map(toEndpoint),
    uniqueRoutes,
    readRoutes,
    mutationRoutes,
    websockets: websockets
      .filter((w) => w.service === 'ladichat' || w.url.toLowerCase().includes('ladi'))
      .map((w) => ({ url: w.url, frameCount: w.frames.length, service: w.service })),
    nestjsHints: buildNestJsHints(ladipageApis),
    rebuildNotes: notes,
  };
}
