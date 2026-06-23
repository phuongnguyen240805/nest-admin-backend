import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH } from '@liora/nest-core'
import { TenantGuard } from '@liora/nest-core'

import {
  CreateGlobalReviewDto,
  ReviewQueryDto,
} from '../dto/review.dto'
import { ReviewService } from '../services/review.service'

@ApiTags('Ecom - Reviews')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ecom/reviews')
export class ReviewGlobalController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  @ApiOperation({ summary: 'List all product reviews (tenant-wide)' })
  list(@Query() dto: ReviewQueryDto) {
    return this.reviewService.listAll(dto)
  }

  @Post()
  @ApiOperation({ summary: 'Create a product review' })
  create(@Body() dto: CreateGlobalReviewDto) {
    return this.reviewService.createGlobal(dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a review by id' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reviewService.removeGlobal(id)
  }
}