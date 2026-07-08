import { ApplicationSeedStore } from '../data/application-seed.store';
import { ApplicationCatalogService } from './application-catalog.service';
import { ApplicationAccessService } from './application-access.service';
import { ApplicationLifecycleService } from './application-lifecycle.service';

const STORE_ID = '6a2c26caef58950011646639';
const TEST_CTX = { storeId: STORE_ID, tenantId: 1, user: { uid: 42 } };
const OTHER_CTX = { storeId: STORE_ID, tenantId: 1, user: { uid: 99 } };

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
    const result = await catalogService.list({ lang: 'vi' }, TEST_CTX);

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
    }, TEST_CTX);
    const list = await catalogService.list({ lang: 'vi' }, TEST_CTX);
    const automation = list.find((item) => item.code === 'Automation');

    expect(updated.status_active).toBe(true);
    expect(updated.status_actived_at).toBeTruthy();
    expect(automation?.status_active).toBe(true);
  });

  it('isolates install state per user account', async () => {
    await lifecycleService.update({
      lang: 'vi',
      code: 'Automation',
      status_active: true,
    }, TEST_CTX);

    const ownerList = await catalogService.list({ lang: 'vi' }, TEST_CTX);
    const otherList = await catalogService.list({ lang: 'vi' }, OTHER_CTX);

    expect(ownerList.find((item) => item.code === 'Automation')?.status_active).toBe(true);
    expect(otherList.find((item) => item.code === 'Automation')?.status_active).not.toBe(true);
  });

  it('upserts Affiliate from the captured update fixture template', async () => {
    const updated = await lifecycleService.update({
      lang: 'vi',
      code: 'Affiliate',
      status_pin: true,
    }, TEST_CTX);

    expect(updated.code).toBe('Affiliate');
    expect(updated.status_pin).toBe(true);
    expect(updated.store_id).toBe(STORE_ID);
  });

  it('resolves seed-catalog templates for apps missing from phaseA fixtures', () => {
    const seedStore = new ApplicationSeedStore();

    expect(seedStore.getApplicationTemplate('AiSeo')?.code).toBe('AiSeo');
    expect(seedStore.getApplicationTemplate('CloudPhone')?.code).toBe('CloudPhone');
    expect(seedStore.getApplicationTemplate('SiteMetrics')?.code).toBe('SiteMetrics');
    expect(seedStore.getApplicationTemplate('UnknownApp')).toBeUndefined();
  });

  it('activates seed-catalog apps through the repository path', async () => {
    const seedStore = new ApplicationSeedStore();
    const accessService = {
      enrichList: jest.fn(async (items: unknown[]) => items),
      assertCanUpdate: jest.fn(async () => undefined),
    } as unknown as ApplicationAccessService;
    const repository = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      })),
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn(async (value: Record<string, unknown>) => value),
    };
    const repositoryLifecycle = new ApplicationLifecycleService(
      seedStore,
      accessService,
      repository as never,
    );

    const updated = await repositoryLifecycle.update({
      lang: 'vi',
      code: 'AiSeo',
      status_active: true,
      status_pin: true,
    }, TEST_CTX);

    expect(updated.code).toBe('AiSeo');
    expect(updated.status_active).toBe(true);
    expect(updated.status_pin).toBe(true);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      code: 'AiSeo',
      statusActive: false,
    }));
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      code: 'AiSeo',
      statusActive: true,
      statusPin: true,
    }));
  });

  it('updates an existing tenant application instead of inserting a duplicate row', async () => {
    const seedStore = new ApplicationSeedStore();
    const accessService = {
      enrichList: jest.fn(async (items: unknown[]) => items),
      assertCanUpdate: jest.fn(async () => undefined),
    } as unknown as ApplicationAccessService;
    const existing = {
      tenantId: 1,
      storeId: STORE_ID,
      code: 'CloudPhone',
      ownerId: '99',
      ladiUid: '99',
      statusActive: true,
      statusPin: false,
      statusActivedAt: new Date('2026-06-24T13:57:15.509Z'),
      installsCount: 1,
    };
    const repository = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existing),
      })),
      create: jest.fn(),
      save: jest.fn(async (value: Record<string, unknown>) => value),
    };
    const repositoryLifecycle = new ApplicationLifecycleService(
      seedStore,
      accessService,
      repository as never,
    );

    const updated = await repositoryLifecycle.update({
      lang: 'vi',
      code: 'CloudPhone',
      status_active: true,
      status_pin: true,
    }, TEST_CTX);

    expect(repository.create).not.toHaveBeenCalled();
    expect(updated.code).toBe('CloudPhone');
    expect(updated.status_active).toBe(true);
    expect(updated.status_pin).toBe(true);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      code: 'CloudPhone',
      ownerId: '42',
      ladiUid: '42',
      statusActive: true,
      statusPin: true,
    }));
  });
});
