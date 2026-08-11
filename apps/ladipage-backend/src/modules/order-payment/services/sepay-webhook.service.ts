import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'

import { OrderPaymentStatus } from '../../ecom-store/common/enums'
import { SepayWebhookDto } from '../dto/sepay-webhook.dto'
import { OrderPaymentEntity, SepayWebhookEventEntity } from '../entities'
import { extractLioraPaymentReference, parseSepayTransactionDate } from '../providers/sepay/sepay-payment'
import { OrderPaymentService } from './order-payment.service'

@Injectable()
export class SepayWebhookService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly orderPayments: OrderPaymentService,
  ) {}

  async process(dto: SepayWebhookDto): Promise<{ duplicate?: boolean; matched?: boolean }> {
    const providerEventId = String(dto.id)
    return this.dataSource.transaction(async (manager) => {
      const webhookRepo = manager.getRepository(SepayWebhookEventEntity)
      await webhookRepo
        .createQueryBuilder()
        .insert()
        .values({
          tenantId: null,
          paymentId: null,
          provider: 'sepay',
          providerEventId,
          status: 'received',
          lastError: null,
          payload: dto as unknown as Record<string, unknown>,
          processedAt: null,
        })
        .orIgnore()
        .execute()

      const webhook = await webhookRepo.findOneByOrFail({ provider: 'sepay', providerEventId })
      if (webhook.status === 'processed') return { duplicate: true, matched: Boolean(webhook.paymentId) }

      if (dto.transferType !== 'in') {
        webhook.status = 'ignored'
        webhook.processedAt = new Date()
        await webhookRepo.save(webhook)
        return { matched: false }
      }

      const referenceCode = extractLioraPaymentReference(dto.code, dto.content)
      if (!referenceCode) {
        webhook.status = 'unmatched'
        webhook.lastError = 'No Liora payment reference found in SePay transaction'
        webhook.processedAt = new Date()
        await webhookRepo.save(webhook)
        return { matched: false }
      }

      const paymentRepo = manager.getRepository(OrderPaymentEntity)
      const payment = await paymentRepo.findOne({ where: { referenceCode, provider: 'sepay' } })
      if (!payment) {
        webhook.status = 'unmatched'
        webhook.lastError = `Payment reference not found: ${referenceCode}`
        webhook.processedAt = new Date()
        await webhookRepo.save(webhook)
        return { matched: false }
      }

      webhook.tenantId = payment.tenantId
      webhook.paymentId = payment.id

      if (payment.status === OrderPaymentStatus.PAID) {
        webhook.status = 'processed'
        webhook.processedAt = new Date()
        await webhookRepo.save(webhook)
        return { duplicate: true, matched: true }
      }

      if (Number(payment.amount) !== Number(dto.transferAmount)) {
        webhook.status = 'rejected'
        webhook.lastError = `Amount mismatch: expected ${Number(payment.amount)}, received ${Number(dto.transferAmount)}`
        webhook.processedAt = new Date()
        await webhookRepo.save(webhook)
        return { matched: true }
      }

      const expectedAccount = this.config.get<string>('SEPAY_BANK_ACCOUNT')?.trim()
      if (expectedAccount && expectedAccount !== dto.accountNumber.trim()) {
        webhook.status = 'rejected'
        webhook.lastError = 'Bank account does not match configured SePay account'
        webhook.processedAt = new Date()
        await webhookRepo.save(webhook)
        return { matched: true }
      }

      const paidAt = parseSepayTransactionDate(dto.transactionDate)
      if (!paidAt) {
        webhook.status = 'rejected'
        webhook.lastError = 'Invalid SePay transactionDate'
        webhook.processedAt = new Date()
        await webhookRepo.save(webhook)
        return { matched: true }
      }

      await this.orderPayments.markPaid(
        payment,
        {
          providerEventId,
          providerTransactionId: dto.referenceCode?.trim() || providerEventId,
          paidAt,
          payload: dto as unknown as Record<string, unknown>,
        },
        manager,
      )
      webhook.status = 'processed'
      webhook.lastError = null
      webhook.processedAt = new Date()
      await webhookRepo.save(webhook)
      return { matched: true }
    })
  }

}
