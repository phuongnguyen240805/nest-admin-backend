import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

/**
 * FilterDto - Base filter DTO with common search, date range and status.
 * Modules should extend this for domain-specific filters (e.g. Funnel status, publish state).
 *
 * Example extension:
 *   export class FunnelFilterDto extends FilterDto {
 *     @IsOptional() @IsEnum(FunnelStatus) status?: FunnelStatus;
 *   }
 */
export class FilterDto {
  @ApiProperty({ description: 'Free text search (name, title, etc.)', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Filter from date (ISO string)', required: false })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({ description: 'Filter to date (ISO string)', required: false })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiProperty({ description: 'Generic status filter', required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
