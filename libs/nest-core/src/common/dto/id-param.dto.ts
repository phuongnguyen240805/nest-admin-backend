import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * IdParamDto - Reusable DTO for route parameters that expect a UUID id.
 * Use together with @Param() in controllers or custom IdParam decorator.
 *
 * Example:
 *   @Get(':id')
 *   findOne(@Param() params: IdParamDto) { ... }
 */
export class IdParamDto {
  @ApiProperty({ description: 'Resource identifier (UUID)', format: 'uuid' })
  @IsUUID('4', { message: 'id must be a valid UUID' })
  id: string;
}
