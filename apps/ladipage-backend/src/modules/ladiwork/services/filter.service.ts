import { Injectable } from '@nestjs/common';

import { LadiworkSeedStore } from '../data/ladiwork-seed.store';

@Injectable()
export class LadiworkFilterService {
  constructor(private readonly seedStore: LadiworkSeedStore) {}

  getSystemFilters(): unknown {
    return this.seedStore.getSystemFilters();
  }
}
