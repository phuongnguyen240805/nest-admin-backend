import { BadRequestException, Injectable } from '@nestjs/common'
import type { AiToolDefinition } from '@liora/ai-gateway'

import { ProductService } from '../../ecom-store/services/product.service'
import type { CustomerCareAiTool, CustomerCareAiToolContext } from './customer-care-ai-tool.types'
import { CustomerCareAiToolGuardService } from './tool-guard.service'

@Injectable()
export class ProductDetailAiTool implements CustomerCareAiTool {
  readonly name = 'get_product'
  constructor(
    private readonly products: ProductService,
    private readonly guard: CustomerCareAiToolGuardService,
  ) {}
  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Lấy thông tin sản phẩm theo productId trong tenant hiện tại.',
      parameters: { type: 'object', required: ['productId'], properties: { productId: { type: 'integer', minimum: 1 } }, additionalProperties: false },
    } }
  }
  async execute(args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    this.guard.assertContext(context)
    const productId = Number(args.productId)
    if (!Number.isInteger(productId)) throw new BadRequestException('productId is required')
    return this.products.detail(productId)
  }
}

@Injectable()
export class ProductSearchAiTool implements CustomerCareAiTool {
  readonly name = 'search_products'
  constructor(
    private readonly products: ProductService,
    private readonly guard: CustomerCareAiToolGuardService,
  ) {}
  definition(): AiToolDefinition {
    return { type: 'function', function: {
      name: this.name,
      description: 'Tìm sản phẩm trong catalog của tenant theo tên hoặc SKU.',
      parameters: { type: 'object', required: ['search'], properties: { search: { type: 'string', minLength: 1, maxLength: 120 } }, additionalProperties: false },
    } }
  }
  async execute(args: Record<string, unknown>, context: CustomerCareAiToolContext) {
    this.guard.assertContext(context)
    const search = String(args.search ?? '').trim()
    if (!search) throw new BadRequestException('search is required')
    return this.products.list({ search, page: 1, pageSize: 20 } as any)
  }
}
