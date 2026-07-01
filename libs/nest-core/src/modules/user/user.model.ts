import { ApiProperty } from '@nestjs/swagger'

export class AccountInfo {
  @ApiProperty({ description: '用户名' })
  username: string

  @ApiProperty({ description: '昵称' })
  nickname: string

  @ApiProperty({ description: '邮箱' })
  email: string

  @ApiProperty({ description: '手机号' })
  phone: string

  @ApiProperty({ description: '备注' })
  remark: string

  @ApiProperty({ description: '头像' })
  avatar: string

  @ApiProperty({ description: '个人简介' })
  bio: string

  @ApiProperty({ description: 'Facebook 链接' })
  socialFacebook: string

  @ApiProperty({ description: 'X 链接' })
  socialX: string

  @ApiProperty({ description: 'LinkedIn 链接' })
  socialLinkedin: string

  @ApiProperty({ description: 'Instagram 链接' })
  socialInstagram: string

  @ApiProperty({ description: '国家' })
  addressCountry: string

  @ApiProperty({ description: '城市/州' })
  addressCityState: string

  @ApiProperty({ description: '邮政编码' })
  postalCode: string

  @ApiProperty({ description: '税号' })
  taxId: string
}
