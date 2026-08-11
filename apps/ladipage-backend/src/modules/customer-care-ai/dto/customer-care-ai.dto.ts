import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class GenerateCustomerCareAiReplyDto {
  @IsOptional() @IsString() @MaxLength(2000) instruction?: string
  @IsOptional() @IsString() @MaxLength(220) triggerMessageId?: string
}

export class AnalyzeCustomerCareConversationDto {
  @IsOptional() @IsString() @MaxLength(220) triggerMessageId?: string
}

export class CustomerCareAiFeedbackDto {
  @IsInt() @Min(-1) @Max(1) rating: number
  @IsOptional() @IsString() @MaxLength(500) reason?: string
  @IsOptional() @IsString() editedContent?: string
}


export class CustomerCareAiActionDecisionDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}


export class UpdateCustomerCareAiConfigDto {
  @IsOptional() @IsBoolean() enabled?: boolean
  @IsOptional() @IsString() @MaxLength(160) model?: string
  @IsOptional() @IsNumber() @Min(0) @Max(2) temperature?: number
  @IsOptional() @IsInt() @Min(128) @Max(8192) maxOutputTokens?: number
  @IsOptional() @IsBoolean() autoReplyEnabled?: boolean
}
