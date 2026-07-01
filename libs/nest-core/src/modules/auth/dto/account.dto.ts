import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger'
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'

import { MenuEntity } from '~/modules/system/menu/menu.entity'

export class AccountUpdateDto {
  @ApiProperty({ description: '用户呢称' })
  @IsString()
  @IsOptional()
  nickname: string

  @ApiProperty({ description: '用户邮箱' })
  @IsOptional()
  @IsEmail()
  email: string

  @ApiProperty({ description: '用户QQ' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  @MinLength(5)
  @MaxLength(11)
  qq: string

  @ApiProperty({ description: '用户手机号' })
  @IsOptional()
  @IsString()
  phone: string

  @ApiProperty({ description: '用户头像' })
  @IsOptional()
  @IsString()
  avatar: string

  @ApiProperty({ description: '用户备注' })
  @IsOptional()
  @IsString()
  remark: string

  @ApiProperty({ description: '个人简介' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio: string

  @ApiProperty({ description: 'Facebook 链接' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  socialFacebook: string

  @ApiProperty({ description: 'X 链接' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  socialX: string

  @ApiProperty({ description: 'LinkedIn 链接' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  socialLinkedin: string

  @ApiProperty({ description: 'Instagram 链接' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  socialInstagram: string

  @ApiProperty({ description: '国家' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressCountry: string

  @ApiProperty({ description: '城市/州' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressCityState: string

  @ApiProperty({ description: '邮政编码' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  postalCode: string

  @ApiProperty({ description: '税号' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId: string
}

export class ResetPasswordDto {
  @ApiProperty({ description: '临时token', example: 'uuid' })
  @IsString()
  accessToken: string

  @ApiProperty({ description: '密码', example: 'a123456' })
  @IsString()
  @Matches(/^\S*(?=\S{6})(?=\S*\d)(?=\S*[A-Z])\S*$/i)
  @MinLength(6)
  password: string
}

export class MenuMeta extends PartialType(OmitType(MenuEntity, ['parentId', 'createdAt', 'updatedAt', 'id', 'roles', 'path', 'name'] as const)) {
  title: string
}
export class AccountMenus extends PickType(MenuEntity, ['id', 'path', 'name', 'component'] as const) {
  meta: MenuMeta
}
