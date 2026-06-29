import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ApplicationSeedStore } from '../../src/modules/app-store/data/application-seed.store';
import { AppStoreRpcRegistrar } from '../../src/modules/app-store/app-store-rpc.registrar';
import { ApplicationCatalogService } from '../../src/modules/app-store/services/application-catalog.service';
import { ApplicationLifecycleService } from '../../src/modules/app-store/services/application-lifecycle.service';
import { RpcDispatcherService } from '../../src/modules/ladipage-rpc/rpc-dispatcher.service';

interface ContractFixture<TData = unknown> {
  request: Record<string, unknown>;
  requestHeaders?: Record<string, string>;
  response: {
    data: TData;
  };
}

const SUCCESS_MESSAGE = 'Th\u00e0nh c\u00f4ng';
const fixtureRoot = join(__dirname, 'fixtures', 'phaseA');

function loadFixture<TData>(fileName: string): ContractFixture<TData> {
  return JSON.parse(readFileSync(join(fixtureRoot, fileName), 'utf8')) as ContractFixture<TData>;
}

function wrapRpc(data: unknown) {
  return { data, message: SUCCESS_MESSAGE, code: 200 };
}

function requiredKeys(value: unknown): string[] {
  return Object.keys(value as Record<string, unknown>);
}

describe('Phase A App Store RPC pilot', () => {
  let dispatcher: RpcDispatcherService;
  let storeId: string;

  beforeEach(() => {
    const seedStore = new ApplicationSeedStore();
    const catalogService = new ApplicationCatalogService(seedStore);
    const lifecycleService = new ApplicationLifecycleService(seedStore);
    dispatcher = new RpcDispatcherService();
    new AppStoreRpcRegistrar(
      dispatcher,
      catalogService,
      lifecycleService,
    ).onModuleInit();
    storeId = seedStore.getStoreId() ?? '6a2c26caef58950011646639';
  });

  it('dispatches application/list with the captured catalog shape', async () => {
    const fixture = loadFixture<Array<Record<string, unknown>>>('application__list.json');
    const response = wrapRpc(await dispatcher.dispatch('application', 'list', fixture.request, { storeId }));
    const data = response.data as Array<Record<string, unknown>>;
    const expected = fixture.response.data;

    expect(response).toMatchObject({ code: 200, message: SUCCESS_MESSAGE });
    expect(data.length).toBe(expected.length);
    expect(data.length).toBeGreaterThanOrEqual(7);
    expect(data.map((item) => item.code)).toEqual(expected.map((item) => item.code));
    expect(requiredKeys(data[0])).toEqual(expect.arrayContaining(requiredKeys(expected[0])));
  });

  it('dispatches application/update for the captured Affiliate pin mutation', async () => {
    const fixture = loadFixture<Record<string, unknown>>('application__update.json');
    const response = wrapRpc(await dispatcher.dispatch('application', 'update', fixture.request, { storeId }));
    const data = response.data as Record<string, unknown>;
    const expected = fixture.response.data;

    expect(response).toMatchObject({ code: 200, message: SUCCESS_MESSAGE });
    expect(data.code).toBe('Affiliate');
    expect(data.status_pin).toBe(true);
    expect(requiredKeys(data)).toEqual(expect.arrayContaining(requiredKeys(expected)));
  });

  it('activates Automation and returns the updated item on the next list', async () => {
    const updateResponse = wrapRpc(await dispatcher.dispatch('application', 'update', {
      lang: 'vi',
      code: 'Automation',
      status_active: true,
    }, { storeId }));
    const listResponse = wrapRpc(await dispatcher.dispatch('application', 'list', {
      lang: 'vi',
    }, { storeId }));
    const apps = listResponse.data as Array<Record<string, unknown>>;
    const automation = apps.find((item) => item.code === 'Automation');

    expect((updateResponse.data as Record<string, unknown>).status_active).toBe(true);
    expect(automation?.status_active).toBe(true);
  });
});
