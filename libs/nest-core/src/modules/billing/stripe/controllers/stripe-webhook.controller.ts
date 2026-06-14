import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { StripeService } from '../stripe.service';
import { StripeWebhookExplorerService } from '../services/stripe-webhook-explorer.service';
import { STRIPE_CONFIG_TOKEN } from '../stripe.constants';
import { StripeConfig } from '../interfaces/stripe-config.interface';
import Stripe from 'stripe';
import { Public } from '~/modules/auth/decorators/public.decorator';

/**
 * Stripe Webhook controller.
 * Mounted at /webhooks/stripe (will be under global prefix, e.g. /api/webhooks/stripe).
 *
 * IMPORTANT:
 * - Must be marked @Public() because nest-admin uses global Jwt/Rbac guards.
 * - Requires raw body (Buffer) attached to request for signature verification.
 *   See fastify.adapter.ts (and donut main.ts) for raw body setup.
 */
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookExplorerService: StripeWebhookExplorerService,
    @Inject(STRIPE_CONFIG_TOKEN) private readonly stripeConfig: StripeConfig,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: any,
  ) {
    try {
      if (!signature) {
        this.logger.warn('Missing Stripe signature header');
        return { success: false, message: 'Missing signature header' };
      }

      if (!this.stripeConfig?.webhookSecret) {
        this.logger.error('Webhook secret is not configured');
        return { success: false, message: 'Webhook secret not configured' };
      }

      const payload: Buffer = request.rawBody || request.body;
      if (!payload) {
        this.logger.warn('Missing raw body for Stripe webhook');
        return { success: false, message: 'Missing raw body' };
      }

      const event = this.stripeService.constructEvent(
        payload,
        signature,
        this.stripeConfig.webhookSecret,
      );

      this.logger.log(`Received webhook event: ${event.type} [${event.id}]`);

      const processed = await this.webhookExplorerService.processWebhookEvent(event);

      return {
        success: true,
        processed,
        eventType: event.type,
        eventId: event.id,
      };
    } catch (error: any) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        this.logger.warn(`Webhook signature verification failed: ${error.message}`);
        return { success: false, message: 'Webhook signature verification failed' };
      }

      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      return { success: false, message: 'Error processing webhook' };
    }
  }
}
