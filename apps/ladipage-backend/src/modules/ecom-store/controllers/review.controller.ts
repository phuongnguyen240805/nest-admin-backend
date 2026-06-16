import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH } from '@liora/nest-core'
import { TenantGuard } from '@liora/nest-core'

import { CreateReviewDto, ReviewQueryDto, UpdateReviewDto } from '../dto/review.dto'
import { ReviewService } from '../services/review.service'

@ApiTags('Ecom - Product Reviews')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ecom/products/:productId/reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  list(
    @Param('productId', ParseIntPipe) productId: number,
    @Query() dto: ReviewQueryDto,
  ) {
    return this.reviewService.list(productId, dto)
  }

  @Get(':id')
  detail(
    @Param('productId', ParseIntPipe) productId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reviewService.detail(productId, id)
  }

  @Post()
  create(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewService.create(productId, dto)
  }

  @Patch(':id')
  update(
    @Param('productId', ParseIntPipe) productId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewService.update(productId, id, dto)
  }

  @Delete(':id')
  remove(
    @Param('productId', ParseIntPipe) productId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reviewService.remove(productId, id)
  }
}