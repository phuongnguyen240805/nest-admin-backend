import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { SupabaseAuthService } from '@liora/supabase'

import { ApiResult } from '~/common/decorators/api-result.decorator'
import { BusinessException } from '~/common/exceptions/biz.exception'
import { Ip } from '~/common/decorators/http.decorator'

import { UserService } from '../user/user.service'

import { AuthService } from './auth.service'
import { Public } from './decorators/public.decorator'
import { LoginDto, RegisterDto } from './dto/auth.dto'
import { AntiSpamRegisterGuard } from './guards/anti-spam-register.guard'
import { LocalGuard } from './guards/local.guard'
import { LoginToken } from './models/auth.model'
import { CaptchaService } from './services/captcha.service'

@ApiTags('Auth - 认证模块')
@UseGuards(LocalGuard)
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private captchaService: CaptchaService,
    private configService: ConfigService,
    private supabaseAuthService: SupabaseAuthService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: '登录' })
  @ApiResult({ type: LoginToken })
  async login(@Body() dto: LoginDto, @Ip()ip: string, @Headers('user-agent')ua: string): Promise<LoginToken> {
    await this.captchaService.checkImgCaptcha(dto.captchaId, dto.verifyCode)
    const token = await this.authService.login(
      dto.username,
      dto.password,
      ip,
      ua,
    )
    return { token }
  }

  @Post('register')
  @UseGuards(AntiSpamRegisterGuard)
  @ApiOperation({ summary: '注册' })
  async register(@Body() dto: RegisterDto): Promise<{ message?: string } | void> {
    const useSupabase = this.configService.get<boolean>('supabase.useSupabaseAuth') ?? false

    if (useSupabase) {
      try {
        const result = await this.supabaseAuthService.signUp(dto.email!, dto.password)
        await this.userService.register(dto)
        if (result.message) {
          return { message: result.message }
        }
      } catch (error) {
        throw new BusinessException(`1209:Supabase 注册失败: ${error.message}`)
      }
    } else {
      await this.userService.register(dto)
    }
  }
}
