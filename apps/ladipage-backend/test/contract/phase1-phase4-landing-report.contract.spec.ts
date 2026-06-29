import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { AnalyticsReportRpcService } from '../../src/modules/analytics/analytics-report-rpc.service'
import { AnalyticsRpcRegistrar } from '../../src/modules/ladipage-rpc/analytics-rpc.registrar'
import { LandingRpcRegistrar } from '../../src/modules/ladipage-rpc/landing-rpc.registrar'
import { RpcDispatcherService } from '../../src/modules/ladipage-rpc/rpc-dispatcher.service'
import { DomainService } from '../../src/modules/domain/domain.service'
import { PageService } from '../../src/modules/publish/services/page.service'

interface ContractFixture<TData = unknown> {
  request: Record<string, unknown>
  requestHeaders?: Record<string, string>
  response: {
    data: TData
  }
}

function loadFixture<TData>(phase: string, fileName: string): ContractFixture<TData> {
  return JSON.parse(
    readFileSync(join(__dirname, 'fixtures', phase, fileName), 'utf8'),
  ) as ContractFixture<TData>
}

describe('Phase 1/4 Landing and report RPC core', () => {
  let dispatcher: RpcDispatcherService
  let storeId: string

  beforeEach(() => {
    dispatcher = new RpcDispatcherService()
    new LandingRpcRegistrar(
      dispatcher,
      new PageService(),
      new DomainService(),
    ).onModuleInit()
    new AnalyticsRpcRegistrar(
      dispatcher,
      new AnalyticsReportRpcService(),
    ).onModuleInit()
    storeId = '6a2c26caef58950011646639'
  })

  it('dispatches ladi-page/list, ladi-page/show, and domain/list', async () => {
    const pageListFixture = loadFixture<Record<string, unknown>>('phase1', 'ladi-page__list.json')
    const pageShowFixture = loadFixture<Record<string, unknown>>('phase1', 'ladi-page__show.json')
    const domainListFixture = loadFixture<Record<string, unknown>>('phase1', 'domain__list.json')

    const pageList = await dispatcher.dispatch('ladi-page', 'list', pageListFixture.request, { storeId })
    const pageShow = await dispatcher.dispatch('ladi-page', 'show', pageShowFixture.request, { storeId })
    const domainList = await dispatcher.dispatch('domain', 'list', domainListFixture.request, { storeId })

    expect((pageList as Record<string, unknown>).items).toEqual(pageListFixture.response.data.items)
    expect((pageShow as Record<string, unknown>).ladipage).toEqual(pageShowFixture.response.data.ladipage)
    expect((domainList as Record<string, unknown>).items).toEqual(domainListFixture.response.data.items)
  })

  it('dispatches report/overview and report/top-product with captured shape', async () => {
    const overviewFixture = loadFixture<Record<string, unknown>>('phase4', 'report__overview.json')
    const topProductFixture = loadFixture<Record<string, unknown>>('phase4', 'report__top-product.json')

    const overview = await dispatcher.dispatch('report', 'overview', overviewFixture.request, { storeId })
    const topProduct = await dispatcher.dispatch('report', 'top-product', topProductFixture.request, { storeId })

    expect(Object.keys(overview as Record<string, unknown>)).toEqual(
      expect.arrayContaining(Object.keys(overviewFixture.response.data)),
    )
    expect((topProduct as Record<string, unknown>).top_product).toEqual(topProductFixture.response.data.top_product)
  })
})
