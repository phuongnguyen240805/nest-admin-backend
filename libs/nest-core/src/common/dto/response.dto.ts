import { ApiProperty } from '@nestjs/swagger';

/**
 * ResponseDto - Unified API response format for success responses.
 * Used together with TransformInterceptor (or manually) to guarantee consistent output shape.
 *
 * Structure:
 * {
 *   success: true,
 *   data: T,
 *   meta?: any   // pagination info, etc.
 * }
 */
export class ResponseDto<T = any> {
  @ApiProperty({ description: 'Indicates if the request was successful' })
  success: boolean = true;

  @ApiProperty({ description: 'Response payload' })
  data: T;

  @ApiProperty({ description: 'Additional metadata (pagination, counts, etc.)', required: false })
  meta?: any;

  constructor(data: T, meta?: any) {
    this.data = data;
    this.meta = meta;
  }
}

/**
 * ErrorResponseDto - Consistent error response format.
 * Typically handled by AllExceptionsFilter.
 */
export class ErrorResponseDto {
  @ApiProperty({ description: 'HTTP status code or business error code' })
  code: number;

  @ApiProperty({ description: 'Human readable error message' })
  message: string;

  @ApiProperty({ description: 'Always null on error', nullable: true })
  data: null = null;

  @ApiProperty({ description: 'Optional error details or stack (dev only)', required: false })
  error?: any;
}
