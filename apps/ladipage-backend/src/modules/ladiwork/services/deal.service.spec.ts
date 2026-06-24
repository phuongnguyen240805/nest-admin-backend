import { LadiworkSeedStore } from '../data/ladiwork-seed.store';
import { LadiworkDealService } from './deal.service';

describe('LadiworkDealService', () => {
  let service: LadiworkDealService;

  beforeEach(() => {
    service = new LadiworkDealService(new LadiworkSeedStore());
  });

  it('lists the seeded deal for the first trial stage', () => {
    const result = service.listByStage({
      pipeline_id: '6a3a8d71da6cd800128221ee',
      pipeline_stage_id: '6a3a8d71da6cd800128221f0',
    }, {
      ownerId: '6a2c26c92d543800211b5157',
    });

    expect(result.total).toBe(1);
    const deals = result.deals as Array<Record<string, unknown>>;
    expect(deals[0]._id).toBe('6a3a8eafda6cd800128266cf');
  });

  it('returns empty deals for stages without seed cards', () => {
    const result = service.listByStage({
      pipeline_id: '6a3a8d71da6cd800128221ee',
      pipeline_stage_id: '6a3a8d71da6cd800128221f1',
    }, {
      ownerId: '6a2c26c92d543800211b5157',
    });

    expect(result.deals).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('builds summary from seed deal and stages', () => {
    const result = service.getSummary({
      pipeline_id: '6a3a8d71da6cd800128221ee',
    }, {
      ownerId: '6a2c26c92d543800211b5157',
    });

    expect(result.total_deals).toBe(1);
    expect(result.stage_count).toBe(4);
    expect((result.summary as Record<string, unknown>).total_value).toBe(10000);
  });
});
