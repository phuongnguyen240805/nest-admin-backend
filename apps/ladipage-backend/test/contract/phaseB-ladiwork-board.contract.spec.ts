import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LadiflowDispatcherService } from '../../src/modules/ladiflow-rpc/ladiflow-dispatcher.service';
import { LadiworkSeedStore } from '../../src/modules/ladiwork/data/ladiwork-seed.store';
import { LadiworkRpcRegistrar } from '../../src/modules/ladiwork/ladiwork-rpc.registrar';
import { LadiworkDealService } from '../../src/modules/ladiwork/services/deal.service';
import { LadiworkFilterService } from '../../src/modules/ladiwork/services/filter.service';
import { LadiworkDashboardService } from '../../src/modules/ladiwork/services/ladiwork-dashboard.service';
import { LadiworkPipelineService } from '../../src/modules/ladiwork/services/pipeline.service';

interface ContractFixture {
  request: Record<string, unknown>;
  requestHeaders?: Record<string, string>;
  response: {
    data: unknown;
  };
}

const fixtureRoot = join(__dirname, 'fixtures', 'phaseB');

function loadFixture(fileName: string): ContractFixture {
  return JSON.parse(readFileSync(join(fixtureRoot, fileName), 'utf8')) as ContractFixture;
}

function wrapRpc(data: unknown) {
  return { data, message: 'Thành công', code: 200 };
}

function requiredKeys(value: unknown): string[] {
  return Object.keys(value as Record<string, unknown>);
}

describe('Phase B LadiWork board RPC pilot', () => {
  let dispatcher: LadiflowDispatcherService;
  let ownerId: string;

  beforeEach(() => {
    const seedStore = new LadiworkSeedStore();
    const pipelineService = new LadiworkPipelineService(seedStore);
    const dealService = new LadiworkDealService(seedStore);
    const dashboardService = new LadiworkDashboardService(seedStore);
    const filterService = new LadiworkFilterService(seedStore);
    dispatcher = new LadiflowDispatcherService();
    new LadiworkRpcRegistrar(
      dispatcher,
      pipelineService,
      dealService,
      dashboardService,
      filterService,
    ).onModuleInit();
    ownerId = seedStore.getOwnerId() ?? '6a2c26c92d543800211b5157';
  });

  it('dispatches crm-pipeline/list without NotImplementedException', async () => {
    const fixture = loadFixture('crm-pipeline__list.json');
    const response = wrapRpc(await dispatcher.dispatch('crm-pipeline', 'list', fixture.request, { ownerId }));
    const expectedItem = ((fixture.response.data as Record<string, unknown>).items as unknown[])[0];
    const actualItem = ((response.data as Record<string, unknown>).items as unknown[])[0];

    expect(response.code).toBe(200);
    expect((response.data as Record<string, unknown>).total).toBeGreaterThanOrEqual(1);
    expect((actualItem as Record<string, unknown>)._id).toBe('6a3a8d71da6cd800128221ee');
    expect(requiredKeys(actualItem)).toEqual(expect.arrayContaining(requiredKeys(expectedItem)));
  });

  it('dispatches crm-deal/list for populated and empty stages', async () => {
    const fixture = loadFixture('crm-deal__list.json');
    const response = wrapRpc(await dispatcher.dispatch('crm-deal', 'list', fixture.request, { ownerId }));
    const emptyStageResponse = wrapRpc(await dispatcher.dispatch('crm-deal', 'list', {
      ...fixture.request,
      pipeline_stage_id: '6a3a8d71da6cd800128221f1',
    }, { ownerId }));

    expect(response.code).toBe(200);
    expect(((response.data as Record<string, unknown>).deals as unknown[]).length).toBe(1);
    expect((emptyStageResponse.data as Record<string, unknown>).deals).toEqual([]);
  });

  it('dispatches crm-deal/get-summary', async () => {
    const fixture = loadFixture('crm-deal__get-summary.json');
    const response = wrapRpc(await dispatcher.dispatch('crm-deal', 'get-summary', fixture.request, { ownerId }));

    expect(response.code).toBe(200);
    expect((response.data as Record<string, unknown>).total_deals).toBe(1);
    expect(((response.data as Record<string, unknown>).summary as Record<string, unknown>).stage_count).toBe(4);
  });

  it('dispatches ladiwork-dashboard/config and crm-filter/get-system-filters', async () => {
    const dashboardFixture = loadFixture('ladiwork-dashboard__config.json');
    const filterFixture = loadFixture('crm-filter__get-system-filters.json');
    const dashboardResponse = wrapRpc(await dispatcher.dispatch('ladiwork-dashboard', 'config', dashboardFixture.request, { ownerId }));
    const filterResponse = wrapRpc(await dispatcher.dispatch('crm-filter', 'get-system-filters', filterFixture.request, { ownerId }));

    expect(((dashboardResponse.data as Record<string, unknown>).widgets as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(filterResponse.data)).toBe(true);
  });
});
