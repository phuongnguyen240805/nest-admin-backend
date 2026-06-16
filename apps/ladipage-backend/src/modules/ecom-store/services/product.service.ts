import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Repository } from 'typeorm'

import { paginate } from '~/helper/paginate'
import { Pagination } from '~/helper/paginate/pagination'
import { TenantContextService } from '~/modules/tenant/tenant-context.service'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from '../dto/product.dto'
import {
  ProductEntity,
  ProductTagEntity,
  ProductTagMapEntity,
} from '../entities'

@Injectable()
export class ProductService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(ProductTagMapEntity)
    private readonly tagMapRepository: Repository<ProductTagMapEntity>,
    @InjectRepository(ProductTagEntity)
    private readonly tagRepository: Repository<ProductTagEntity>,
    private readonly dataSource: DataSource,
  ) {
    super(tenantContext)
  }

  async list(dto: ProductQueryDto): Promise<Pagination<ProductEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.productRepository
      .createQueryBuilder('product')
      .where('product.tenantId = :tenantId', { tenantId })

    if (dto.search) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search)',
        { search: `%${dto.search}%` },
      )
    }

    if (dto.status) {
      qb.andWhere('product.status = :status', { status: dto.status })
    }

    qb.orderBy('product.createdAt', 'DESC')
    return paginate(qb, { page: dto.page, pageSize: dto.pageSize })
  }

  async detail(id: number) {
    const product = await this.findOneForTenantOrFail(
      this.productRepository,
      { id },
      'Product not found',
    )
    const tagIds = await this.tagMapRepository.find({ where: { productId: id } })
    const tags = tagIds.length
      ? await this.tagRepository.find({
          where: {
            id: In(tagIds.map((m) => m.tagId)),
            tenantId: this.requireTenantId(),
          },
        })
      : []
    return { ...product, tags: tags.map((t) => t.name) }
  }

  async create(dto: CreateProductDto) {
    const tenantId = this.requireTenantId()

    return this.dataSource.transaction(async (manager) => {
      const product = await manager.getRepository(ProductEntity).save({
        tenantId,
        name: dto.name,
        sku: dto.sku,
        price: dto.price,
        stock: dto.stock ?? 0,
        status: dto.status,
        description: dto.description ?? null,
        categoryId: dto.categoryId ?? null,
        imageUrl: dto.imageUrl ?? null,
      })

      if (dto.tagIds?.length) {
        await manager.getRepository(ProductTagMapEntity).save(
          dto.tagIds.map((tagId) => ({ productId: product.id, tagId })),
        )
      }

      return this.detail(product.id)
    })
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOneForTenantOrFail(
      this.productRepository,
      { id },
      'Product not found',
    )

    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ProductEntity).update(id, {
        name: dto.name,
        sku: dto.sku,
        price: dto.price,
        stock: dto.stock,
        status: dto.status,
        description: dto.description,
        categoryId: dto.categoryId,
        imageUrl: dto.imageUrl,
      })

      if (dto.tagIds) {
        await manager.getRepository(ProductTagMapEntity).delete({ productId: id })
        if (dto.tagIds.length) {
          await manager.getRepository(ProductTagMapEntity).save(
            dto.tagIds.map((tagId) => ({ productId: id, tagId })),
          )
        }
      }

      return this.detail(id)
    })
  }

  async remove(id: number) {
    const product = await this.findOneForTenantOrFail(
      this.productRepository,
      { id },
      'Product not found',
    )

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ProductTagMapEntity).delete({ productId: id })
      await manager.getRepository(ProductEntity).remove(product)
    })
  }
}