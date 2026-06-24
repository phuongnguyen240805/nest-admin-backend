import { Injectable } from '@nestjs/common';
import type { LpLadiworkDashboard } from '@liora/ladipage-types';

import { mapLadiworkDashboardRpcItem } from '../../ladiflow-rpc/mappers/ladiwork/dashboard.mapper';
import { LadiworkSeedStore } from '../data/ladiwork-seed.store';

@Injectable()
export class LadiworkDashboardService {
  constructor(private readonly seedStore: LadiworkSeedStore) {}

  config(): LpLadiworkDashboard {
    return mapLadiworkDashboardRpcItem(this.seedStore.getDashboardConfig());
  }
}
