import { Injectable } from '@nestjs/common'
import type { LpApplication } from '@liora/ladipage-types'

import type { RpcContext } from '../../ladipage-rpc/rpc-dispatcher.service'
import { APP_ACCESS_RULES } from '../application-access.config'

type UpdateApplicationPayload = {
  code?: unknown
  status_active?: unknown
  status_pin?: unknown
}

@Injectable()
export class ApplicationAccessService {
  async enrichList(
    applications: LpApplication[],
    _ctx: RpcContext,
  ): Promise<LpApplication[]> {
    return applications.map((application) => this.normalizeCatalogPrice(application))
  }

  async assertCanUpdate(
    _application: LpApplication,
    _body: UpdateApplicationPayload,
    _ctx: RpcContext,
  ): Promise<void> {
    // Permission and billing gates are handled in a later phase.
  }

  private normalizeCatalogPrice(application: LpApplication): LpApplication {
    const rule = APP_ACCESS_RULES[String(application.code ?? '')]
    if (!rule) return application

    return {
      ...application,
      price: rule.priceVnd,
      installs_count: application.installs_count ?? 0,
      views_count: application.views_count ?? 0,
    }
  }
}