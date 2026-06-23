import type { ApiEntry, NestJsHint } from '../types.js';
import { inferDtoName } from '../utils.js';

function toPascalCase(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function toControllerName(service: string): string {
  return `${toPascalCase(service)}Controller`;
}

function toModuleName(service: string): string {
  return `${toPascalCase(service)}Module`;
}

function normalizeRoute(path: string): string {
  const cleaned = path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

export function buildNestJsHints(apis: ApiEntry[]): NestJsHint[] {
  const seen = new Set<string>();
  const hints: NestJsHint[] = [];

  for (const api of apis) {
    const service = api.service ?? 'generic';
    const route = normalizeRoute(api.path);
    const key = `${api.method}:${route}:${service}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tags = [service];
    if (api.host) tags.push(api.host);

    hints.push({
      module: toModuleName(service),
      controller: toControllerName(service),
      route,
      method: api.method,
      requestDto: api.requestBody !== undefined ? inferDtoName(route, 'Request') : undefined,
      responseDto: api.responseBody !== undefined ? inferDtoName(route, 'Response') : undefined,
      tags,
    });
  }

  return hints.sort((a, b) => a.route.localeCompare(b.route));
}

export function buildOpenApiStub(hints: NestJsHint[]): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const h of hints) {
    paths[h.route] ??= {};
    const method = h.method.toLowerCase();
    paths[h.route][method] = {
      tags: h.tags,
      operationId: `${h.controller}_${method}_${h.route.replace(/[^a-zA-Z0-9]/g, '_')}`,
      requestBody: h.requestDto
        ? { content: { 'application/json': { schema: { $ref: `#/components/schemas/${h.requestDto}` } } } }
        : undefined,
      responses: {
        '200': {
          description: 'OK',
          content: h.responseDto
            ? { 'application/json': { schema: { $ref: `#/components/schemas/${h.responseDto}` } } }
            : undefined,
        },
      },
    };
  }

  const schemas: Record<string, unknown> = {};
  for (const h of hints) {
    if (h.requestDto) schemas[h.requestDto] = { type: 'object', additionalProperties: true };
    if (h.responseDto) schemas[h.responseDto] = { type: 'object', additionalProperties: true };
  }

  return {
    openapi: '3.0.3',
    info: { title: 'CDP Reverse Engineering Export', version: '1.0.0' },
    paths,
    components: { schemas },
  };
}