import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { TenantGuard } from '~/common/guards/tenant.guard'
import { GetOrgFromRequest } from '~/libraries/nestjs_libraries/src/user/org.from.request'
import { GetUserFromRequest } from '~/libraries/nestjs_libraries/src/user/user.from.request'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UserEntity as User } from '../user/user.entity'
import { Organization } from './entities/organization.entity'
import { BillingService } from './services/billing.service'

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('/billing')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('/check/:id')
  checkId(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this.billingService.checkId(org, id)
  }

  @Get('/check-discount')
  checkDiscount(@GetOrgFromRequest() org: Organization) {
    return this.billingService.checkDiscount(org)
  }

  @Post('/apply-discount')
  applyDiscount(@GetOrgFromRequest() org: Organization) {
    return this.billingService.applyDiscount(org)
  }

  @Post('/finish-trial')
  finishTrial(@GetOrgFromRequest() org: Organization) {
    return this.billingService.finishTrial(org)
  }

  @Get('/is-trial-finished')
  isTrialFinished(@GetOrgFromRequest() org: Organization) {
    return this.billingService.isTrialFinished(org)
  }

  @Post('/embedded')
  embedded(@GetOrgFromRequest() org: Organization, @GetUserFromRequest() user: User, @Body() body, @Req() req: Request) {
    const uniqueId = req?.cookies?.track
    return this.billingService.embedded(org, user, body, uniqueId)
  }

  @Post('/subscribe')
  subscribe(@GetOrgFromRequest() org: Organization, @GetUserFromRequest() user: User, @Body() body, @Req() req: Request) {
    const uniqueId = req?.cookies?.track
    return this.billingService.subscribe(org, user, body, uniqueId)
  }

  @Get('/portal')
  modifyPayment(@GetOrgFromRequest() org: Organization) {
    return this.billingService.getPortalLink(org)
  }

  @Get('/')
  getCurrentBilling(@GetOrgFromRequest() org: Organization) {
    return this.billingService.getCurrentBilling(org)
  }

  // @Post('/cancel')
  // cancel(@GetOrgFromRequest() org: Organization, @GetUserFromRequest() user: User, @Body() body: { feedback: string }) {
  //   return this.billingService.cancel(org, user, body.feedback)
  // }

  @Post('/prorate')
  prorate(@GetOrgFromRequest() org: Organization, @Body() body) {
    return this.billingService.prorate(org, body)
  }

  @Post('/lifetime')
  lifetime(@GetOrgFromRequest() org: Organization, @Body() body: { code: string }) {
    return this.billingService.lifetime(org, body.code)
  }

  // @Get('/charges')
  // getCharges(@GetUserFromRequest() user: User, @GetOrgFromRequest() org: Organization) {
  //   return this.billingService.getCharges(org, user)
  // }

  // @Post('/refund-charges')
  // refundCharges(@GetUserFromRequest() user: User, @GetOrgFromRequest() org: Organization, @Body() body: { chargeIds: string[] }) {
  //   return this.billingService.refundCharges(org, user, body.chargeIds)
  // }

  // @Post('/cancel-subscription')
  // cancelSubscription(@GetUserFromRequest() user: User, @GetOrgFromRequest() org: Organization) {
  //   return this.billingService.cancelSubscription(org, user)
  // }

  // @Post('/add-subscription')
  // addSubscription(@GetUserFromRequest() user: User, @GetOrgFromRequest() org: Organization, @Body() body: { subscription: string }) {
  //   return this.billingService.addSubscription(org, user, body.subscription)
  // }

  @Get('/crypto')
  crypto(@GetOrgFromRequest() org: Organization) {
    return this.billingService.crypto(org)
  }
}
