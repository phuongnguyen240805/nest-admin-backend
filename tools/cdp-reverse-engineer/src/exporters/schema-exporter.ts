import type { LadipageEndpoint } from './ladipage-flow.js';

const READ_ACTION_RE =
  /\/(list|show|get|search|info|theme|asset|select|checkout|filter|report|summary|analytics|overview|top-product|activity|customer-detail)(-|\/|$)/i;
const MUTATION_ACTION_RE =
  /\/(create|update|delete|save|duplicate|publish|insert|remove|clone|copy|add|edit|submit|sync|export|import)(-|\/|$)/i;

export type RouteKind = 'read' | 'mutation' | 'unknown';

export function classifyRoute(path: string): RouteKind {
  const segment = (path.split('/').pop() ?? path).toLowerCase();
  const mutPrefix = /^(create|update|delete|save|duplicate|publish|insert|remove|clone|copy|add|edit|submit|sync|export|import)/;
  const readPrefix =
    /^(list|show|get|search|info|theme|asset|select|checkout|filter|report|summary|analytics|activity|customer-detail)/;
  if (mutPrefix.test(segment) || MUTATION_ACTION_RE.test(path)) return 'mutation';
  if (readPrefix.test(segment) || READ_ACTION_RE.test(path)) return 'read';
  return 'unknown';
}

export interface FieldSchema {
  name: string;
  type: string;
  nullable: boolean;
  sample?: unknown;
}

export interface EntitySchema {
  route: string;
  host: string;
  path: string;
  kind: RouteKind;
  status?: number;
  hasValidResponse: boolean;
  isEmpty: boolean;
  requestFields: FieldSchema[];
  responseFields: FieldSchema[];
  itemFields: FieldSchema[];
  sampleRequest?: unknown;
  sampleResponse?: unknown;
  suggestedTable?: string;
}

export interface SchemaDraft {
  generatedAt: string;
  routeCount: number;
  readRoutes: number;
  mutationRoutes: number;
  entities: EntitySchema[];
  gaps: string[];
}

function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'datetime';
    if (/^[a-f0-9]{24}$/i.test(value)) return 'objectId';
    return 'string';
  }
  if (typeof value === 'object') return 'object';
  return 'unknown';
}

function fieldsFromObject(obj: Record<string, unknown>, maxDepth = 1): FieldSchema[] {
  const out: FieldSchema[] = [];
  for (const [name, value] of Object.entries(obj)) {
    out.push({
      name,
      type: inferType(value),
      nullable: value === null || value === undefined,
      sample: typeof value === 'object' && value !== null ? undefined : value,
    });
    if (maxDepth > 0 && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [child, cv] of Object.entries(value as Record<string, unknown>)) {
        out.push({
          name: `${name}.${child}`,
          type: inferType(cv),
          nullable: cv === null || cv === undefined,
          sample: typeof cv === 'object' ? undefined : cv,
        });
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const ITEM_ARRAY_KEYS = [
  'items',
  'orders',
  'products',
  'pages',
  'domains',
  'tags',
  'staffs',
  'staff',
  'themes',
  'templates',
  'forms',
  'leads',
  'categories',
  'reviews',
  'inventories',
  'customers',
  'persons',
  'companies',
  'segments',
  'activities',
  'broadcasts',
  'organizations',
  'subscribers',
  'sync_errors',
  'list',
  'records',
  'data',
  'series',
  'labels',
];

const ENTITY_OBJECT_KEYS = [
  'ladipage',
  'order',
  'product',
  'store',
  'domain',
  'form_config',
  'page',
  'checkout',
  'shipping',
  'inventory',
  'customer',
  'segment',
  'person',
  'company',
  'report',
  'dashboard',
  'analytics',
];

const NESTED_ARRAY_TABLE: Record<string, string> = {
  order_items: 'lp_order_item',
  order_item: 'lp_order_item',
  line_items: 'lp_order_item',
  order_details: 'lp_order_item',
  order_products: 'lp_order_item',
  product_items: 'lp_order_item',
  product_options: 'lp_product_option',
  variants: 'lp_inventory',
  option_values: 'lp_product_option_value',
};

function pickItemSample(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    return data[0] as Record<string, unknown>;
  }
  if (typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;

  for (const key of ENTITY_OBJECT_KEYS) {
    const v = obj[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  }

  for (const key of ITEM_ARRAY_KEYS) {
    const v = obj[key];
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
      return v[0] as Record<string, unknown>;
    }
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      return value[0] as Record<string, unknown>;
    }
  }
  return null;
}

export interface NestedTableSchema {
  table: string;
  parentRoute: string;
  arrayKey: string;
  fields: FieldSchema[];
}

function pickNestedTables(data: unknown, parentRoute: string): NestedTableSchema[] {
  if (!data || typeof data !== 'object') return [];
  const out: NestedTableSchema[] = [];

  const scan = (obj: Record<string, unknown>, route: string, depth = 0): void => {
    for (const [key, value] of Object.entries(obj)) {
      const table = NESTED_ARRAY_TABLE[key];
      if (table && Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        out.push({
          table,
          parentRoute: route,
          arrayKey: key,
          fields: fieldsFromObject(value[0] as Record<string, unknown>),
        });
      }
      if (depth < 2 && value && typeof value === 'object' && !Array.isArray(value)) {
        const child = value as Record<string, unknown>;
        const childRoute = ENTITY_OBJECT_KEYS.includes(key) ? `${route} → ${key}` : route;
        scan(child, childRoute, depth + 1);
      }
    }
  };

  scan(data as Record<string, unknown>, parentRoute);
  return out;
}

function mergeFields(a: FieldSchema[], b: FieldSchema[]): FieldSchema[] {
  const map = new Map<string, FieldSchema>();
  for (const f of [...a, ...b]) {
    const prev = map.get(f.name);
    if (!prev || (prev.type === 'null' && f.type !== 'null')) {
      map.set(f.name, f);
    }
  }
  return [...map.values()].sort((x, y) => x.name.localeCompare(y.name));
}

export interface MergedTableSchema {
  table: string;
  sourceRoutes: string[];
  fields: FieldSchema[];
  kind: RouteKind;
  nestedFrom?: string[];
}

export function buildMergedTables(draft: SchemaDraft): MergedTableSchema[] {
  const byTable = new Map<string, MergedTableSchema>();

  for (const entity of draft.entities) {
    if (!entity.suggestedTable || entity.itemFields.length === 0) continue;
    const prev = byTable.get(entity.suggestedTable);
    if (prev) {
      prev.sourceRoutes.push(entity.route);
      prev.fields = mergeFields(prev.fields, entity.itemFields);
      if (entity.kind === 'mutation') prev.kind = 'mutation';
    } else {
      byTable.set(entity.suggestedTable, {
        table: entity.suggestedTable,
        sourceRoutes: [entity.route],
        fields: entity.itemFields,
        kind: entity.kind,
      });
    }

    const resBody = entity.sampleResponse as { data?: unknown } | undefined;
    for (const nested of pickNestedTables(resBody?.data, entity.route)) {
      const n = byTable.get(nested.table);
      const routeLabel = `${entity.route} → ${nested.arrayKey}`;
      if (n) {
        n.sourceRoutes.push(routeLabel);
        n.fields = mergeFields(n.fields, nested.fields);
        n.nestedFrom = [...(n.nestedFrom ?? []), nested.arrayKey];
      } else {
        byTable.set(nested.table, {
          table: nested.table,
          sourceRoutes: [routeLabel],
          fields: nested.fields,
          kind: 'read',
          nestedFrom: [nested.arrayKey],
        });
      }
    }
  }

  return [...byTable.values()].sort((a, b) => a.table.localeCompare(b.table));
}

function isEmptyData(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return Object.values(obj).every((v) => {
    if (Array.isArray(v)) return v.length === 0;
    if (v === null || v === undefined || v === 0 || v === '') return true;
    return false;
  });
}

function suggestTable(path: string): string | undefined {
  if (/\/2\.0\/api-key\//i.test(path)) return 'lp_api_key';
  if (/\/2\.0\/workspace\//i.test(path)) return 'lp_workspace_usage';
  if (/\/ladi-page\/report/i.test(path)) return 'lp_page_report';
  if (/\/dashboard\//i.test(path)) return 'lp_dashboard';
  if (/\/2\.0\/report\//i.test(path)) return 'lp_analytics_report';

  const m10 = path.match(/\/1\.0\/([^/]+)\//);
  if (m10) {
    const raw10 = m10[1].replace(/-/g, '_');
    const map10: Record<string, string> = {
      customer: 'lp_customer',
      customer_tag: 'lp_customer_tag',
      segment: 'lp_customer_segment',
      custom_field: 'lp_customer_custom_field',
      crm_organization: 'lp_company',
      sync_error: 'lp_sync_error_log',
      ladipage_notification: 'lp_notification',
      progress_bar: 'lp_onboarding',
      call_center: 'lp_call_center',
      dash_board: 'lp_dashboard',
      crm_insight_folder: 'lp_analytics_widget',
      broadcast: 'lp_broadcast',
    };
    return map10[raw10] ?? `lp_${raw10}`;
  }

  const m = path.match(/\/2\.0\/([^/]+)\//);
  if (!m) return undefined;
  const raw = m[1].replace(/-/g, '_');
  const map: Record<string, string> = {
    ladi_page: 'lp_page',
    ladi_page_tag: 'lp_page_tag',
    domain: 'lp_domain',
    form_config: 'lp_form_config',
    data_form_error: 'lp_lead',
    order: 'lp_order',
    product: 'lp_product',
    product_category: 'lp_product_category',
    product_tag: 'lp_product_tag',
    order_tag: 'lp_order_tag',
    custom_field: 'lp_custom_field',
    product_review: 'lp_product_review',
    inventory: 'lp_inventory',
    shipping: 'lp_delivery_note',
    theme: 'lp_template',
    staff: 'lp_staff',
    application: 'lp_application',
    store: 'lp_store',
    page_checkout: 'lp_page_checkout',
    checkout: 'lp_checkout',
    filter: 'lp_filter',
    list_show_case: 'lp_template',
    customer: 'lp_customer',
    payment: 'lp_payment',
    checkout_config: 'lp_checkout_config',
    order_history: 'lp_order_history',
    customer_segment: 'lp_customer_segment',
    customer_tag: 'lp_customer_tag',
    customer_custom_field: 'lp_customer_custom_field',
    sync_error: 'lp_sync_error_log',
    data_form_error: 'lp_lead',
    person: 'lp_customer',
    company: 'lp_company',
    report: 'lp_analytics_report',
    dashboard: 'lp_dashboard',
    analytics: 'lp_analytics_report',
    workspace: 'lp_workspace',
  };
  return map[raw] ?? `lp_${raw}`;
}

function isValidResponse(ep: LadipageEndpoint): boolean {
  if (ep.status !== 200) return false;
  const body = ep.responseBody;
  if (!body || typeof body !== 'object') return false;
  if ('error' in body) return false;
  const code = (body as { code?: number }).code;
  return code === undefined || code === 200;
}

export function buildSchemaDraft(endpoints: LadipageEndpoint[]): SchemaDraft {
  const byRoute = new Map<string, LadipageEndpoint>();
  for (const ep of endpoints) {
    const key = `${ep.host}${ep.path}`;
    const prev = byRoute.get(key);
    if (!prev || !isValidResponse(prev) && isValidResponse(ep)) {
      byRoute.set(key, ep);
    }
  }

  const entities: EntitySchema[] = [];
  const gaps: string[] = [];

  for (const ep of [...byRoute.values()].sort((a, b) => `${a.host}${a.path}`.localeCompare(`${b.host}${b.path}`))) {
    const kind = classifyRoute(ep.path);
    const resBody = ep.responseBody as { data?: unknown } | undefined;
    const data = resBody?.data;
    const item = pickItemSample(data);
    const reqObj =
      ep.requestBody && typeof ep.requestBody === 'object'
        ? (ep.requestBody as Record<string, unknown>)
        : {};

    const entity: EntitySchema = {
      route: `${ep.method} ${ep.host}${ep.path}`,
      host: ep.host,
      path: ep.path,
      kind,
      status: ep.status,
      hasValidResponse: isValidResponse(ep),
      isEmpty: isValidResponse(ep) ? isEmptyData(data) : true,
      requestFields: fieldsFromObject(reqObj),
      responseFields: data && typeof data === 'object' && !Array.isArray(data) ? fieldsFromObject(data as Record<string, unknown>) : [],
      itemFields: item ? fieldsFromObject(item) : [],
      sampleRequest: ep.requestBody,
      sampleResponse: isValidResponse(ep) ? ep.responseBody : undefined,
      suggestedTable: suggestTable(ep.path),
    };
    entities.push(entity);

    if (!entity.hasValidResponse) {
      gaps.push(`${entity.route} — response invalid (status=${ep.status})`);
    } else if (entity.isEmpty && kind === 'read') {
      gaps.push(`${entity.route} — read OK but empty sample (cần seed data hoặc mutation)`);
    }
  }

  const readRoutes = entities.filter((e) => e.kind === 'read').length;
  const mutationRoutes = entities.filter((e) => e.kind === 'mutation').length;

  if (mutationRoutes === 0) {
    gaps.push('Không có mutation route — cần chạy config *-mutations.json với form submit');
  }

  const requiredTables = [
    'lp_page',
    'lp_order',
    'lp_order_item',
    'lp_product',
    'lp_product_category',
    'lp_product_tag',
    'lp_order_tag',
    'lp_custom_field',
    'lp_customer',
    'lp_customer_segment',
    'lp_customer_tag',
    'lp_customer_custom_field',
    'lp_company',
    'lp_analytics_report',
    'lp_dashboard',
  ];
  const mergedTables = buildMergedTables({
    generatedAt: new Date().toISOString(),
    routeCount: entities.length,
    readRoutes,
    mutationRoutes,
    entities,
    gaps: [],
  });
  const covered = new Set(mergedTables.map((t) => t.table));
  for (const t of requiredTables) {
    if (!covered.has(t)) {
      gaps.push(`Bảng ${t} — chưa có itemFields từ capture`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    routeCount: entities.length,
    readRoutes,
    mutationRoutes,
    entities,
    gaps: [...new Set(gaps)],
  };
}

export function mergeSchemaDrafts(drafts: SchemaDraft[]): SchemaDraft {
  const allEndpoints: LadipageEndpoint[] = [];
  for (const d of drafts) {
    for (const e of d.entities) {
      allEndpoints.push({
        method: 'POST',
        host: e.host,
        path: e.path,
        url: `https://${e.host}${e.path}`,
        status: e.status,
        requestBody: e.sampleRequest,
        responseBody: e.sampleResponse,
        requestHeaders: {},
        timestamp: d.generatedAt,
      });
    }
  }
  const merged = buildSchemaDraft(allEndpoints);
  merged.gaps = [
    ...merged.gaps,
    ...drafts.flatMap((d) => d.gaps.map((g) => `[${d.generatedAt}] ${g}`)),
  ];
  return merged;
}
