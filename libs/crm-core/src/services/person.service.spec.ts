import { DataSource } from 'typeorm'

import { CrmPersonEntity } from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'

import { CrmCompanyService } from './company.service'
import { CrmPersonService } from './person.service'

describe('CrmPersonService', () => {
  const tenantId = 1

  const mockTenantContext = {
    getTenantId: jest.fn(() => tenantId),
  } as unknown as TenantContextService

  const mockPersonRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    count: jest.fn(),
  }

  const mockCompanyService = {
    findOrCreateByEmailDomain: jest.fn(),
    linkPersonToCompany: jest.fn(),
  } as unknown as CrmCompanyService

  const mockActivityService = {
    log: jest.fn(),
  }

  const mockDataSource = {
    transaction: jest.fn((cb) =>
      cb({
        getRepository: () => ({
          save: jest.fn(async (data) => ({ id: 'uuid-new', ...data })),
          update: jest.fn(),
        }),
      }),
    ),
  } as unknown as DataSource

  let service: CrmPersonService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CrmPersonService(
      mockTenantContext,
      mockPersonRepo as never,
      mockCompanyService,
      mockActivityService as never,
      mockDataSource,
    )
  })

  describe('countActive', () => {
    it('counts non-deleted persons for tenant', async () => {
      mockPersonRepo.count.mockResolvedValue(7)
      const count = await service.countActive()
      expect(count).toBe(7)
      expect(mockPersonRepo.count).toHaveBeenCalled()
    })
  })

  describe('findOrCreateByContact', () => {
    it('returns existing person matched by phone', async () => {
      const existing = { id: 'uuid-1', tenantId, primaryPhone: '0901234567' }
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existing),
      }
      mockPersonRepo.createQueryBuilder.mockReturnValue(qb)

      const result = await service.findOrCreateByContact({
        name: 'Nguyen Van A',
        phone: '090-123-4567',
        email: 'a@acme.com',
      })

      expect(result).toBe(existing)
      expect(mockDataSource.transaction).not.toHaveBeenCalled()
    })

    it('returns existing person matched by email when phone not found', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }
      mockPersonRepo.createQueryBuilder.mockReturnValue(qb)

      const existing = { id: 'uuid-2', tenantId, primaryEmail: 'b@acme.com' }
      mockPersonRepo.findOne.mockResolvedValue(existing)

      const result = await service.findOrCreateByContact({
        name: 'B Tran',
        phone: '',
        email: 'b@acme.com',
      })

      expect(result).toBe(existing)
    })

    it('creates new person and auto-links company for corporate email', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }
      mockPersonRepo.createQueryBuilder.mockReturnValue(qb)
      mockPersonRepo.findOne.mockResolvedValue(null)

      const company = { id: 'company-uuid', name: 'Acme', domain: 'acme.com' }
      ;(mockCompanyService.findOrCreateByEmailDomain as jest.Mock).mockResolvedValue(
        company,
      )

      const result = await service.findOrCreateByContact({
        name: 'New Contact',
        phone: '0999888777',
        email: 'new@acme.com',
      })

      expect(result.id).toBe('uuid-new')
      expect(mockCompanyService.findOrCreateByEmailDomain).toHaveBeenCalledWith(
        'new@acme.com',
        expect.anything(),
      )
      expect(mockCompanyService.linkPersonToCompany).toHaveBeenCalledWith(
        'uuid-new',
        'company-uuid',
        expect.anything(),
      )
    })
  })
})