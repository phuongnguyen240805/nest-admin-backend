import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { APPLICATION_SEED_CATALOG } from './application-seed-catalog';

interface ContractFixture<TData = unknown> {
  capturedAt?: string;
  requestHeaders?: Record<string, string>;
  response?: {
    data?: TData;
  };
}

type JsonRecord = Record<string, unknown>;

const PHASE_A_FIXTURES = {
  applicationList: 'application__list.json',
  applicationUpdate: 'application__update.json',
} as const;

@Injectable()
export class ApplicationSeedStore {
  private readonly fixtureDir = this.resolveFixtureDir();
  private readonly applicationsByScope = new Map<string, JsonRecord[]>();

  listApplications(scopeKey: string): JsonRecord[] {
    return this.clone(this.stateApplications(scopeKey));
  }

  findApplicationByCode(code: string, scopeKey: string, storeId?: string): JsonRecord | undefined {
    const application = this.stateApplications(scopeKey).find((item) =>
      item.code === code && this.matchesStore(item, storeId));
    return application ? this.clone(application) : undefined;
  }

  getApplicationTemplate(code: string): JsonRecord | undefined {
    const fixtureApps = this.readFixtureData<JsonRecord[]>(PHASE_A_FIXTURES.applicationList);
    const fromCatalog = fixtureApps.find((item) => item.code === code);
    if (fromCatalog) return this.clone(fromCatalog);

    const updateTemplate = this.getUpdateTemplate();
    return updateTemplate.code === code ? updateTemplate : undefined;
  }

  saveApplication(application: JsonRecord, scopeKey: string): JsonRecord {
    const applications = this.stateApplications(scopeKey);
    const index = applications.findIndex((item) =>
      item.code === application.code && item.store_id === application.store_id);

    if (index >= 0) {
      applications[index] = this.clone(application);
    } else {
      applications.push(this.clone(application));
    }

    return this.clone(application);
  }

  getStoreId(): string | undefined {
    const fixture = this.readFixture<JsonRecord[]>(PHASE_A_FIXTURES.applicationList);
    return fixture.requestHeaders?.['store-id'];
  }

  getUpdateTimestamp(): string | undefined {
    const fixture = this.readFixture<JsonRecord>(PHASE_A_FIXTURES.applicationUpdate);
    const data = fixture.response?.data;
    return String(data?.status_actived_at ?? data?.updated_at ?? fixture.capturedAt ?? '') || undefined;
  }

  private getUpdateTemplate(): JsonRecord {
    return this.readFixtureData<JsonRecord>(PHASE_A_FIXTURES.applicationUpdate);
  }

  private stateApplications(scopeKey: string): JsonRecord[] {
    if (!this.applicationsByScope.has(scopeKey)) {
      this.applicationsByScope.set(
        scopeKey,
        this.mergeCatalogTemplates(
          this.readFixtureData<JsonRecord[]>(PHASE_A_FIXTURES.applicationList),
          scopeKey,
        ),
      );
    }

    return this.applicationsByScope.get(scopeKey)!;
  }

  private mergeCatalogTemplates(applications: JsonRecord[], scopeKey: string): JsonRecord[] {
    const { ownerId, storeId } = this.parseScopeKey(scopeKey);
    const base = applications.map((application) => this.withMetricDefaults({
      ...application,
      owner_id: ownerId,
      ladi_uid: ownerId,
      store_id: storeId ?? application.store_id,
    }));
    const byCode = new Set(base.map((application) => String(application.code ?? '')));
    const timestamp = this.getUpdateTimestamp() ?? new Date().toISOString();

    for (const item of APPLICATION_SEED_CATALOG) {
      if (byCode.has(item.code)) continue;

      base.push({
        _id: `seed-${ownerId}-${item.code}`,
        store_id: storeId ?? this.getStoreId() ?? 'default-store',
        owner_id: ownerId,
        ladi_uid: ownerId,
        name: item.name,
        code: item.code,
        logo: '',
        thumb: '',
        price: item.price,
        status_active: item.statusActive === true,
        status_actived_at: item.statusActive === true ? timestamp : null,
        status_pin: item.statusPin === true,
        is_delete: false,
        installs_count: item.installsCount ?? 0,
        views_count: 0,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }

    return base;
  }

  private parseScopeKey(scopeKey: string): { tenantId: string; ownerId: string; storeId?: string } {
    const [tenantId, ownerId, storeId] = scopeKey.split(':');
    return { tenantId, ownerId, storeId: storeId === 'default' ? undefined : storeId };
  }

  private withMetricDefaults(application: JsonRecord): JsonRecord {
    return {
      installs_count: 0,
      views_count: 0,
      ...application,
    };
  }

  private matchesStore(item: JsonRecord, storeId?: string): boolean {
    return !storeId || item.store_id === storeId;
  }

  private readFixtureData<TData>(fileName: string): TData {
    return this.clone(this.readFixture<TData>(fileName).response?.data) as TData;
  }

  private readFixture<TData>(fileName: string): ContractFixture<TData> {
    const path = join(this.fixtureDir, fileName);
    return JSON.parse(readFileSync(path, 'utf8')) as ContractFixture<TData>;
  }

  private resolveFixtureDir(): string {
    const relative = join('apps', 'ladipage-backend', 'test', 'contract', 'fixtures', 'phaseA');
    const appRelative = join('test', 'contract', 'fixtures', 'phaseA');
    let current = process.cwd();

    for (let index = 0; index < 6; index += 1) {
      const workspaceCandidate = join(current, relative);
      if (existsSync(workspaceCandidate)) return workspaceCandidate;

      const appCandidate = join(current, appRelative);
      if (existsSync(appCandidate)) return appCandidate;

      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }

    return join(process.cwd(), relative);
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value ?? null)) as T;
  }
}