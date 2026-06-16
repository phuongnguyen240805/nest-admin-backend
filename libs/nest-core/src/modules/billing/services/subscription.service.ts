import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PlanTier, SubscriptionDto } from '@liora/api-types';
import { CreditWallet } from '../entities/credit-wallet.entity';
import {
  Period,
  Subscription,
  SubscriptionTier,
} from '../entities/subscription.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,

    @InjectRepository(CreditWallet)
    private creditWalletRepo: Repository<CreditWallet>,
  ) {}

  async getSubscriptionByOrganizationId(organizationId: string) {
    return this.subscriptionRepo.findOne({
      where: { organizationId },
      relations: ['organization'],
    });
  }

  async getOrCreateSubscription(organizationId: string): Promise<Subscription> {
    const existing = await this.getSubscriptionByOrganizationId(organizationId);
    if (existing) return existing;

    const subscription = this.subscriptionRepo.create({
      organizationId,
      subscriptionTier: SubscriptionTier.FREE,
      period: Period.MONTHLY,
    });
    return this.subscriptionRepo.save(subscription);
  }

  async upsertSubscription(
    organizationId: string,
    updateData: Partial<Subscription>,
  ): Promise<Subscription> {
    const subscription = await this.getOrCreateSubscription(organizationId);
    Object.assign(subscription, updateData);
    return this.subscriptionRepo.save(subscription);
  }

  async addSubscription(
    organizationId: string,
    userId: string,
    subscriptionData: any,
  ) {
    return this.upsertSubscription(organizationId, subscriptionData);
  }

  async updateSubscription(
    organizationId: string,
    updateData: Partial<Subscription>,
  ) {
    const subscription = await this.getOrCreateSubscription(organizationId);
    await this.subscriptionRepo.update({ id: subscription.id }, updateData);
    return this.getSubscriptionByOrganizationId(organizationId);
  }

  async getCreditBalance(organizationId: string): Promise<number> {
    const subscription =
      await this.getSubscriptionByOrganizationId(organizationId);
    if (!subscription) return 0;

    const wallet = await this.creditWalletRepo.findOne({
      where: { userId: subscription.id },
    });

    return wallet ? Number(wallet.balance) : 0;
  }

  async getCreditSpent(organizationId: string): Promise<number> {
    const subscription =
      await this.getSubscriptionByOrganizationId(organizationId);
    if (!subscription) return 0;

    const wallet = await this.creditWalletRepo.findOne({
      where: { userId: subscription.id },
    });

    return wallet ? Number(wallet.totalSpent) : 0;
  }

  toSubscriptionDto(subscription: Subscription): SubscriptionDto {
    return {
      id: subscription.id,
      organizationId: subscription.organizationId,
      subscriptionTier: subscription.subscriptionTier as PlanTier,
      period: subscription.period as SubscriptionDto['period'],
      identifier: subscription.identifier,
      cancelAt: subscription.cancelAt?.toISOString(),
      isLifetime: subscription.isLifetime,
      createdAt: subscription.createdAt?.toISOString(),
      updatedAt: subscription.updatedAt?.toISOString(),
    };
  }

  async updateCredit(organizationId: string, amount: number) {
    const subscription = await this.getOrCreateSubscription(organizationId);
    let wallet = await this.creditWalletRepo.findOne({
      where: { userId: subscription.id },
    });

    if (wallet) {
      wallet.balance = Number(wallet.balance) + amount;
      return this.creditWalletRepo.save(wallet);
    }

    return this.creditWalletRepo.save(
      this.creditWalletRepo.create({
        userId: subscription.id,
        balance: amount,
      }),
    );
  }
}
