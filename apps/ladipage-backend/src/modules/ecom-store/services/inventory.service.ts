import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { TenantContextService } from '~/modules/tenant/tenant-context.service'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import { UpdateInventoryDto } from '../dto/inventory.dto'
import { ProductEntity } from '../entities'

@Injectable()
export class InventoryService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {
    super(tenantContext)
  }

  async update(productId: number, dto: UpdateInventoryDto) {
    const product = await this.findOneForTenantOrFail(
      this.productRepository,
      { id: productId },
      'Product not found',
    )

    if (dto.stock !== undefined && dto.delta !== undefined) {
      throw new BadRequestException('Provide either stock or delta, not both')
    }

    if (dto.stock !== undefined) {
      product.stock = dto.stock
    } else if (dto.delta !== undefined) {
      product.stock = Math.max(0, product.stock + dto.delta)
    } else {
      throw new BadRequestException('stock or delta is required')
    }

    return this.productRepository.save(product)
  }
}