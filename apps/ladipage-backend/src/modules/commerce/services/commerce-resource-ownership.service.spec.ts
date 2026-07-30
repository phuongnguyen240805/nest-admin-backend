import type { Repository } from 'typeorm'

import type { TenantContextService } from '@liora/nest-core'

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}))
jest.mock('@liora/nest-core', () => ({
  TenantContextService: class TenantContextService {},
}))
jest.mock('@nestjs/swagger', () => ({
  ApiHideProperty: () => () => undefined,
  ApiProperty: () => () => undefined,
}))

import { CommerceResourceOwnershipEntity } from '../entities/commerce-resource-ownership.entity'
import { CommerceAdminResourceService } from './commerce-admin-resource.service'
import { CommerceResourceOwnershipService } from './commerce-resource-ownership.service'

type Row = CommerceResourceOwnershipEntity

function matches(row: Row, where: Partial<Row>): boolean {
  return Object.entries(where).every(
    ([key, value]) => row[key as keyof Row] === value,
  )
}

function buildHarness() {
  let tenantId = 1
  let sequence = 1
  const rows: Row[] = []
  const tenantContext = {
    getTenantId: () => tenantId,
  } as unknown as TenantContextService

  const repository = {
    create: (input: Partial<Row>) => input as Row,
    save: async (input: Row) => {
      const row = { ...input, id: input.id ?? sequence++ } as Row
      rows.push(row)
      return row
    },
    find: async ({ where }: { where: Partial<Row> }) =>
      rows.filter(row => matches(row, where)),
    findOne: async ({ where }: { where: Partial<Row> }) =>
      rows.find(row => matches(row, where)) ?? null,
    delete: async (where: Partial<Row>) => {
      const kept = rows.filter(row => !matches(row, where))
      const affected = rows.length - kept.length
      rows.splice(0, rows.length, ...kept)
      return { affected, raw: [] }
    },
  } as unknown as Repository<Row>

  const ownership = new CommerceResourceOwnershipService(
    tenantContext,
    repository,
  )

  return {
    ownership,
    rows,
    setTenant: (value: number) => {
      tenantId = value
    },
  }
}

describe('Commerce resource cross-tenant isolation', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.COMMERCE_MEDUSA_MOCK = 'true'
    process.env.COMMERCE_MEDUSA_ENABLED = 'true'
    process.env.COMMERCE_OWNERSHIP_APP_ID = 'ladipage-test'
    process.env.COMMERCE_OWNERSHIP_ENV = 'test'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('does not expose tenant A ownership to tenant B', async () => {
    const harness = buildHarness()
    await harness.ownership.claim('same-org', 'categories', 'cat_a')

    expect(
      await harness.ownership.listExternalIds('same-org', 'categories'),
    ).toEqual(['cat_a'])

    harness.setTenant(2)
    expect(
      await harness.ownership.listExternalIds('same-org', 'categories'),
    ).toEqual([])
    expect(
      await harness.ownership.owns('same-org', 'categories', 'cat_a'),
    ).toBe(false)
  })

  it('prevents a second tenant from claiming a known Medusa id', async () => {
    const harness = buildHarness()
    await harness.ownership.claim('org-a', 'product-tags', 'ptag_shared')
    harness.setTenant(2)

    await expect(
      harness.ownership.claim('org-b', 'product-tags', 'ptag_shared'),
    ).rejects.toThrow('already owned')
  })

  it('blocks list, update and delete across tenants even with same org and id', async () => {
    const harness = buildHarness()
    const resources = new CommerceAdminResourceService(harness.ownership)

    const created = await resources.create(
      'categories',
      'same-org',
      { name: 'Tenant A category' },
    )
    expect(await resources.list('categories', 'same-org')).toHaveLength(1)

    harness.setTenant(2)
    expect(await resources.list('categories', 'same-org')).toEqual([])
    await expect(
      resources.update(
        'categories',
        'same-org',
        created.id,
        { name: 'stolen' },
      ),
    ).rejects.toThrow('not found')
    await expect(
      resources.remove('categories', 'same-org', created.id),
    ).rejects.toThrow('not found')

    harness.setTenant(1)
    expect(
      (await resources.list('categories', 'same-org'))[0]?.name,
    ).toBe('Tenant A category')
  })
})
