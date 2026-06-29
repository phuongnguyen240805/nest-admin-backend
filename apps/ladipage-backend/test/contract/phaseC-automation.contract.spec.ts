import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { AutomationRpcRegistrar } from '../../src/modules/automation/automation-rpc.registrar'
import { AutomationV5RpcRegistrar } from '../../src/modules/automation/automation-v5-rpc.registrar'
import { AutomationService } from '../../src/modules/automation/services/automation.service'
import { LadiflowDispatcherService } from '../../src/modules/ladiflow-rpc/ladiflow-dispatcher.service'

interface ContractFixture<TData = unknown> {
  request: Record<string, unknown>
  requestHeaders?: Record<string, string>
  response: {
    data: TData
  }
}

const fixtureRoot = join(__dirname, 'fixtures', 'phaseC')

function loadFixture<TData>(fileName: string): ContractFixture<TData> {
  return JSON.parse(readFileSync(join(fixtureRoot, fileName), 'utf8')) as ContractFixture<TData>
}

describe('Phase C Automation RPC core', () => {
  let dispatcher: LadiflowDispatcherService
  let ownerId: string

  beforeEach(() => {
    const automationService = new AutomationService()
    dispatcher = new LadiflowDispatcherService()
    new AutomationRpcRegistrar(dispatcher, automationService).onModuleInit()
    new AutomationV5RpcRegistrar(dispatcher, automationService).onModuleInit()
    ownerId = '6a2c26c92d543800211b5157'
  })

  it('dispatches flow/list and broadcast/list with captured list shape', async () => {
    const flowFixture = loadFixture<Record<string, unknown>>('flow__list.json')
    const broadcastFixture = loadFixture<Record<string, unknown>>('broadcast__list.json')
    const flowResponse = await dispatcher.dispatch('flow', 'list', flowFixture.request, { ownerId })
    const broadcastResponse = await dispatcher.dispatch('broadcast', 'list', broadcastFixture.request, { ownerId })

    expect((flowResponse as Record<string, unknown>).items).toEqual(flowFixture.response.data.items)
    expect((broadcastResponse as Record<string, unknown>).items).toEqual(broadcastFixture.response.data.items)
  })

  it('dispatches integration/list-all, flow-tag/list-all, and v5 flow/show', async () => {
    const integrationFixture = loadFixture<Record<string, unknown>>('integration__list-all.json')
    const flowTagFixture = loadFixture<Record<string, unknown>>('flow-tag__list-all.json')
    const flowShowFixture = loadFixture<Record<string, unknown>>('flow__show.json')

    const integrations = await dispatcher.dispatch('integration', 'list-all', integrationFixture.request, { ownerId })
    const flowTags = await dispatcher.dispatch('flow-tag', 'list-all', flowTagFixture.request, { ownerId })
    const flowShow = await dispatcher.dispatch('flow', 'show', flowShowFixture.request, { ownerId })

    expect((integrations as Record<string, unknown>).items).toEqual(integrationFixture.response.data.items)
    expect((flowTags as Record<string, unknown>).items).toEqual(flowTagFixture.response.data.items)
    expect((flowShow as Record<string, unknown>).flow).toEqual(flowShowFixture.response.data.flow)
  })
})
