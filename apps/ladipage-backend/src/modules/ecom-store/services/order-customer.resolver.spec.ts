import { CrmPersonService } from '@liora/crm-core'

import { CustomerService } from '../../crm/services/customer.service'
import { OrderCustomerResolver } from './order-customer.resolver'

describe('OrderCustomerResolver', () => {
  const originalFlag = process.env.CRM_ENABLED

  const mockCustomerService = {
    findOrCreateByContact: jest.fn(),
  } as unknown as CustomerService

  const mockPersonService = {
    findOrCreateByContact: jest.fn(),
  } as unknown as CrmPersonService

  let resolver: OrderCustomerResolver

  beforeEach(() => {
    jest.clearAllMocks()
    resolver = new OrderCustomerResolver(mockCustomerService, mockPersonService)
  })

  afterEach(() => {
    process.env.CRM_ENABLED = originalFlag
  })

  it('uses lp_customer when CRM is disabled', async () => {
    process.env.CRM_ENABLED = 'false'
    ;(mockCustomerService.findOrCreateByContact as jest.Mock).mockResolvedValue({
      id: 42,
    })

    const result = await resolver.resolve({
      name: 'A',
      phone: '0901234567',
      email: 'a@test.com',
    })

    expect(result).toEqual({ customerId: 42, personId: null })
    expect(mockPersonService.findOrCreateByContact).not.toHaveBeenCalled()
  })

  it('uses crm_person when CRM is enabled', async () => {
    process.env.CRM_ENABLED = 'true'
    ;(mockPersonService.findOrCreateByContact as jest.Mock).mockResolvedValue({
      id: 'uuid-person',
    })

    const result = await resolver.resolve({
      name: 'B',
      phone: '0912345678',
    })

    expect(result).toEqual({ customerId: null, personId: 'uuid-person' })
    expect(mockCustomerService.findOrCreateByContact).not.toHaveBeenCalled()
  })
})