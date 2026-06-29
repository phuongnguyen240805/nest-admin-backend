import { ApplicationSeedStore } from '../data/application-seed.store';
import { ApplicationCatalogService } from './application-catalog.service';
import { ApplicationLifecycleService } from './application-lifecycle.service';

const STORE_ID = '6a2c26caef58950011646639';

describe('ApplicationCatalogService', () => {
  let catalogService: ApplicationCatalogService;
  let lifecycleService: ApplicationLifecycleService;

  beforeEach(() => {
    const seedStore = new ApplicationSeedStore();
    catalogService = new ApplicationCatalogService(seedStore);
    lifecycleService = new ApplicationLifecycleService(seedStore);
  });

  it('lists application catalog from the phaseA fixture', () => {
    const result = catalogService.list({ lang: 'vi' }, { storeId: STORE_ID });

    expect(result.length).toBe(7);
    expect(result.map((item) => item.code)).toEqual(expect.arrayContaining([
      'WebsiteBuilder',
      'Automation',
      'Ecommerce',
      'LadiWork',
    ]));
  });

  it('activates Automation in the in-memory catalog', () => {
    const updated = lifecycleService.update({
      lang: 'vi',
      code: 'Automation',
      status_active: true,
    }, { storeId: STORE_ID });
    const list = catalogService.list({ lang: 'vi' }, { storeId: STORE_ID });
    const automation = list.find((item) => item.code === 'Automation');

    expect(updated.status_active).toBe(true);
    expect(updated.status_actived_at).toBeTruthy();
    expect(automation?.status_active).toBe(true);
  });

  it('upserts Affiliate from the captured update fixture template', () => {
    const updated = lifecycleService.update({
      lang: 'vi',
      code: 'Affiliate',
      status_pin: true,
    }, { storeId: STORE_ID });

    expect(updated.code).toBe('Affiliate');
    expect(updated.status_pin).toBe(true);
    expect(updated.store_id).toBe(STORE_ID);
  });
});
