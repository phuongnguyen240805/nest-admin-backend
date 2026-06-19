import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import { CreateReviewDto, ReviewQueryDto, UpdateReviewDto } from '../dto/review.dto'
import { ProductEntity, ProductReviewEntity } from '../entities'

@Injectable()
export class ReviewService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(ProductReviewEntity)
    private readonly reviewRepository: Repository<ProductReviewEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {
    super(tenantContext)
  }

  async list(
    productId: number,
    dto: ReviewQueryDto,
  ): Promise<Pagination<ProductReviewEntity>> {
    await this.findOneForTenantOrFail(
      this.productRepository,
      { id: productId },
      'Product not found',
    )

    const tenantId = this.requireTenantId()
    const qb = this.reviewRepository
      .createQueryBuilder('review')
      .where('review.tenantId = :tenantId', { tenantId })
      .andWhere('review.productId = :productId', { productId })
      .orderBy('review.createdAt', 'DESC')

    return paginate(qb, { page: dto.page, pageSize: dto.pageSize })
  }

  async detail(productId: number, id: number) {
    await this.findOneForTenantOrFail(
      this.productRepository,
      { id: productId },
      'Product not found',
    )

    const review = await this.reviewRepository.findOne({
      where: { id, productId, tenantId: this.requireTenantId() },
    })

    if (!review) {
      const { NotFoundException } = await import('@nestjs/common')
      throw new NotFoundException('Review not found')
    }

    return review
  }

  async create(productId: number, dto: CreateReviewDto) {
    await this.findOneForTenantOrFail(
      this.productRepository,
      { id: productId },
      'Product not found',
    )

    return this.reviewRepository.save({
      tenantId: this.requireTenantId(),
      productId,
      rating: dto.rating,
      content: dto.content ?? null,
      reviewerName: dto.reviewerName ?? null,
    })
  }

  async update(productId: number, id: number, dto: UpdateReviewDto) {
    const review = await this.detail(productId, id)
    Object.assign(review, dto)
    return this.reviewRepository.save(review)
  }

  async remove(productId: number, id: number) {
    const review = await this.detail(productId, id)
    await this.reviewRepository.remove(review)
  }
}