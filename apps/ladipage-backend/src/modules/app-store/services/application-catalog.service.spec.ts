import { ApplicationSeedStore } from '../data/application-seed.store';
import { ApplicationCatalogService } from './application-catalog.service';
import { ApplicationAccessService } from './application-access.service';
import { ApplicationLifecycleService } from './application-lifecycle.service';

const STORE_ID = '6a2c26caef58950011646639';

describe('ApplicationCatalogService', () => {
  let catalogService: ApplicationCatalogService;
  let lifecycleService: ApplicationLifecycleService;

  beforeEach(() => {
    const seedStore = new ApplicationSeedStore();
    const accessService = {
      enrichList: jest.fn(async (items: unknown[]) => items),
      assertCanUpdate: jest.fn(async () => undefined),
    } as unknown as ApplicationAccessService;
    catalogService = new ApplicationCatalogService(seedStore, accessService);
    lifecycleService = new ApplicationLifecycleService(seedStore, accessService);
  });

  it('lists application catalog from the phaseA fixture and seed catalog', async () => {
    const result = await catalogService.list({ lang: 'vi' }, { storeId: STORE_ID });

    expect(result.map((item) => item.code)).toEqual(expect.arrayContaining([
      'WebsiteBuilder',
      'Automation',
      'Ecommerce',
      'LadiWork',
      'AiSeo',
    ]));
  });

  it('activates Automation in the in-memory catalog', async () => {
    const updated = await lifecycleService.update({
      lang: 'vi',
      code: 'Automation',
      status_active: true,
    }, { storeId: STORE_ID });
    const list = await catalogService.list({ lang: 'vi' }, { storeId: STORE_ID });
    const automation = list.find((item) => item.code === 'Automation');

    expect(updated.status_active).toBe(true);
    expect(updated.status_actived_at).toBeTruthy();
    expect(automation?.status_active).toBe(true);
  });

  it('upserts Affiliate from the captured update fixture template', async () => {
    const updated = await lifecycleService.update({
      lang: 'vi',
      code: 'Affiliate',
      status_pin: true,
    }, { storeId: STORE_ID });

    expect(updated.code).toBe('Affiliate');
    expect(updated.status_pin).toBe(true);
    expect(updated.store_id).toBe(STORE_ID);
  });
});
