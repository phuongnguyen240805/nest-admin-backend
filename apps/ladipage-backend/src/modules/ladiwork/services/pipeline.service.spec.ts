import { LadiworkSeedStore } from '../data/ladiwork-seed.store';
import { LadiworkPipelineService } from './pipeline.service';

describe('LadiworkPipelineService', () => {
  let service: LadiworkPipelineService;

  beforeEach(() => {
    service = new LadiworkPipelineService(new LadiworkSeedStore());
  });

  it('lists the seeded trial pipeline with stages', () => {
    const result = service.list({ page: 1, limit: 100 }, {
      ownerId: '6a2c26c92d543800211b5157',
    });

    expect(result.total).toBeGreaterThanOrEqual(1);
    const items = result.items as Array<Record<string, unknown>>;
    expect(items[0]._id).toBe('6a3a8d71da6cd800128221ee');
    expect((items[0].stages as unknown[]).length).toBe(4);
  });

  it('returns an empty page when pagination exceeds seed data', () => {
    const result = service.list({ page: 2, limit: 100 }, {
      ownerId: '6a2c26c92d543800211b5157',
    });

    expect(result.items).toEqual([]);
  });

  it('keeps crm-pipeline/search grouped shape', () => {
    const result = service.search({ category: 'ALL' }, {
      ownerId: '6a2c26c92d543800211b5157',
    });
    const groups = result.groups as Array<Record<string, unknown>>;

    expect(groups.length).toBeGreaterThanOrEqual(1);
    expect(groups[0].count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(groups[0].pipelines)).toBe(true);
  });
});
