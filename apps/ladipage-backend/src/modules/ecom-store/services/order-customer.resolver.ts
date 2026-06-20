import { Injectable } from '@nestjs/common'

import { CrmPersonService, isCrmEnabled } from '@liora/crm-core'

import { CustomerService } from '../../crm/services/customer.service'

export interface OrderCustomerContactInput {
  name: string
  phone: string
  email?: string | null
}

export interface ResolvedOrderCustomer {
  customerId: number | null
  personId: string | null
}

/**
 * Resolves order customer link — lp_customer (v1) or crm_person (v2).
 */
@Injectable()
export class OrderCustomerResolver {
  constructor(
    private readonly customerService: CustomerService,
    private readonly personService: CrmPersonService,
  ) {}

  async resolve(input: OrderCustomerContactInput): Promise<ResolvedOrderCustomer> {
    if (isCrmEnabled()) {
      const person = await this.personService.findOrCreateByContact(input)
      return { customerId: null, personId: person.id }
    }

    const customer = await this.customerService.findOrCreateByContact(input)
    return { customerId: customer.id, personId: null }
  }
}