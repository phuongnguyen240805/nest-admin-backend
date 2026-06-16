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
import { LoginDto, RegisterDto, SupabaseExchangeDto } from './dto/auth.dto'
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
  @ApiOperation({
    summary: '登录 — legacy (captcha + local) hoặc Supabase password khi USE_SUPABASE_AUTH=true',
  })
  @ApiResult({ type: LoginToken })
  async login(@Body() dto: LoginDto, @Ip()ip: string, @Headers('user-agent')ua: string): Promise<LoginToken> {
    await this.captchaService.checkImgCaptcha(dto.captchaId, dto.verifyCode)

    const useSupabase = this.configService.get<boolean>('supabase.useSupabaseAuth') ?? false

    if (useSupabase) {
      const token = await this.authService.loginWithSupabasePassword(
        dto.email,
        dto.password,
        ip,
        ua,
      )
      return { token }
    }

    const token = await this.authService.login(
      dto.email,
      dto.password,
      ip,
      ua,
    )
    return { token }
  }

  @Post('exchange')
  @ApiOperation({ summary: 'Đổi Supabase access token lấy Nest JWT nội bộ' })
  @ApiResult({ type: LoginToken })
  async exchange(
    @Body() dto: SupabaseExchangeDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ): Promise<LoginToken> {
    const useSupabase = this.configService.get<boolean>('supabase.useSupabaseAuth') ?? false
    if (!useSupabase) {
      throw new BusinessException('1213:Supabase Auth chưa được bật (USE_SUPABASE_AUTH=false).')
    }

    const token = await this.authService.loginWithSupabaseAccessToken(
      dto.supabaseAccessToken,
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
        await this.userService.ensureEmailNotRegistered(dto.email)
        const result = await this.supabaseAuthService.signUp(dto.email, dto.password)
        await this.userService.register(dto, result.supabaseUserId)
        if (result.message) {
          return { message: result.message }
        }
      }
      catch (error) {
        if (error instanceof BusinessException) {
          throw error
        }
        const detail = error instanceof Error ? error.message : String(error)
        throw new BusinessException(`1209:Đăng ký Supabase thất bại — ${detail}`)
      }
    }
    else {
      await this.userService.register(dto)
    }
  }
}