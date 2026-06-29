import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
  private applications?: JsonRecord[];

  listApplications(): JsonRecord[] {
    return this.clone(this.stateApplications());
  }

  findApplicationByCode(code: string, storeId?: string): JsonRecord | undefined {
    const application = this.stateApplications().find((item) =>
      item.code === code && this.matchesStore(item, storeId));
    return application ? this.clone(application) : undefined;
  }

  getApplicationTemplate(code: string): JsonRecord | undefined {
    const fromCatalog = this.stateApplications().find((item) => item.code === code);
    if (fromCatalog) return this.clone(fromCatalog);

    const updateTemplate = this.getUpdateTemplate();
    return updateTemplate.code === code ? updateTemplate : undefined;
  }

  saveApplication(application: JsonRecord): JsonRecord {
    const applications = this.stateApplications();
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

  private stateApplications(): JsonRecord[] {
    if (!this.applications) {
      this.applications = this.readFixtureData<JsonRecord[]>(PHASE_A_FIXTURES.applicationList);
    }

    return this.applications;
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
