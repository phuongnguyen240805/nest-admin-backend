import { ApiProperty } from '@nestjs/swagger'
import { IsInt } from 'class-validator'

export class StartSessionDto {
  /** Booking id (Nest-owned) to start a remote-control session for. */
  @ApiProperty()
  @IsInt()
  bookingId: number
}
