import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface ContractFixture<TData = unknown> {
  requestHeaders?: Record<string, string>;
  response?: {
    data?: TData;
  };
}

type JsonRecord = Record<string, unknown>;

const PHASE_B_FIXTURES = {
  dealList: 'crm-deal__list.json',
  dealSummary: 'crm-deal__get-summary.json',
  dashboardConfig: 'ladiwork-dashboard__config.json',
  pipelineList: 'crm-pipeline__list.json',
  pipelineSearch: 'crm-pipeline__search.json',
  systemFilters: 'crm-filter__get-system-filters.json',
} as const;

@Injectable()
export class LadiworkSeedStore {
  private readonly fixtureDir = this.resolveFixtureDir();

  getPipelines(): JsonRecord[] {
    const data = this.readFixtureData<{ items?: JsonRecord[] }>(PHASE_B_FIXTURES.pipelineList);
    return this.clone(data.items ?? []);
  }

  getPipelineSearchData(): JsonRecord {
    return this.readFixtureData<JsonRecord>(PHASE_B_FIXTURES.pipelineSearch);
  }

  getDeals(): JsonRecord[] {
    const data = this.readFixtureData<{ deals?: JsonRecord[] }>(PHASE_B_FIXTURES.dealList);
    return this.clone(data.deals ?? []);
  }

  getDealListTemplate(): JsonRecord {
    return this.readFixtureData<JsonRecord>(PHASE_B_FIXTURES.dealList);
  }

  getDealSummaryTemplate(): JsonRecord {
    return this.readFixtureData<JsonRecord>(PHASE_B_FIXTURES.dealSummary);
  }

  getDashboardConfig(): JsonRecord {
    return this.readFixtureData<JsonRecord>(PHASE_B_FIXTURES.dashboardConfig);
  }

  getSystemFilters(): unknown {
    return this.readFixtureData<unknown>(PHASE_B_FIXTURES.systemFilters);
  }

  getOwnerId(): string | undefined {
    const fixture = this.readFixture<JsonRecord>(PHASE_B_FIXTURES.pipelineList);
    return fixture.requestHeaders?.['owner-id'];
  }

  private readFixtureData<TData>(fileName: string): TData {
    return this.clone(this.readFixture<TData>(fileName).response?.data) as TData;
  }

  private readFixture<TData>(fileName: string): ContractFixture<TData> {
    const path = join(this.fixtureDir, fileName);
    return JSON.parse(readFileSync(path, 'utf8')) as ContractFixture<TData>;
  }

  private resolveFixtureDir(): string {
    const relative = join('apps', 'ladipage-backend', 'test', 'contract', 'fixtures', 'phaseB');
    const appRelative = join('test', 'contract', 'fixtures', 'phaseB');
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
