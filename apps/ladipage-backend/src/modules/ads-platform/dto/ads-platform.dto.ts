import { Type } from 'class-transformer'
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

import { ADS_PROVIDERS, type AdsProvider } from '@liora/ads-contracts'

export class StartAdsOAuthDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  returnTo?: string
}

export class CreateAdsSyncJobDto {
  @IsIn(ADS_PROVIDERS)
  provider: AdsProvider

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  connectionId: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  externalAccountId: string

  @IsIn(['CAMPAIGNS', 'PERFORMANCE'])
  resource: 'CAMPAIGNS' | 'PERFORMANCE'

  @IsOptional()
  @IsDateString()
  since?: string

  @IsOptional()
  @IsDateString()
  until?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  idempotencyKey: string
}

export class CreateAdsPublishJobDto {
  @IsIn(ADS_PROVIDERS)
  provider: AdsProvider

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  connectionId: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  externalAccountId: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  idempotencyKey: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  revision: number

  @IsObject()
  draft: Record<string, unknown>
}

export class IngestBrowserSnapshotDto {
  @IsIn(ADS_PROVIDERS)
  provider: AdsProvider

  @IsOptional()
  @IsString()
  @IsUUID()
  connectionId?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  externalAccountId: string

  @IsDateString()
  observedAt: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  schemaVersion: number

  @IsObject()
  payload: Record<string, unknown>
}

export class CreateAdsExtensionSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  deviceId: string
}

export class ListAdsSnapshotsDto {
  @IsIn(ADS_PROVIDERS)
  provider: AdsProvider

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  externalAccountId: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
