import { ApiProperty } from '@nestjs/swagger'

import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class LoginDto {
  @ApiProperty({ description: '邮箱' })
  @IsEmail()
  email: string

  @ApiProperty({ description: '密码', example: 'a123456' })
  @IsString()
  @Matches(/^\S*(?=\S{6})(?=\S*\d)(?=\S*[A-Z])\S*$/i)
  @MinLength(6)
  password: string

  @ApiProperty({ description: '验证码标识' })
  @IsString()
  captchaId: string

  @ApiProperty({ description: '用户输入的验证码' })
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  verifyCode: string
}

export class SupabaseExchangeDto {
  @ApiProperty({ description: 'Supabase access token from client signInWithPassword / signUp session' })
  @IsString()
  @MinLength(10)
  supabaseAccessToken: string
}

export class RegisterDto {
  @ApiProperty({ description: 'Tên đăng nhập / hiển thị' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username: string

  @ApiProperty({ description: '邮箱' })
  @IsEmail()
  email: string

  @ApiProperty({ description: '密码' })
  @IsString()
  @Matches(/^\S*(?=\S{6})(?=\S*\d)(?=\S*[A-Z])\S*$/i)
  @MinLength(6)
  @MaxLength(16)
  password: string

  @ApiProperty({ description: '语言', examples: ['EN', 'ZH'] })
  @IsString()
  lang: string
}
