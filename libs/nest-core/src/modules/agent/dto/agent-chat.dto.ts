import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class AgentChatDto {
  @ApiProperty({ description: 'Message forwarded to the LibreFang agent runtime' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32_000)
  message: string
}
