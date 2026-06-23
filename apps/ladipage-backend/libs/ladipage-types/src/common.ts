/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

export type LadipageJsonPrimitive = string | number | boolean | null;
export type LadipageJsonValue = LadipageJsonPrimitive | LadipageJsonObject | LadipageJsonValue[];
export interface LadipageJsonObject {
  [key: string]: LadipageJsonValue;
}

export interface LadipageRpcResponse<TData> {
  data: TData;
  message: string;
  code: 200;
}

export interface PagedSearch {
  paged?: number;
  limit?: number;
  search?: string;
  key_word?: string;
  lang?: string;
}

export interface SortBody {
  sort?: string | Record<string, unknown>;
  sort_by?: string;
  sort_type?: 'asc' | 'desc' | 'ASC' | 'DESC' | string;
}
