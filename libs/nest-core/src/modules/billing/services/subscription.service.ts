import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CreditWallet } from '../entities/credit-wallet.entity'
import { Subscription } from '../entities/subscription.entity'

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
    })
  }

  async addSubscription(organizationId: string, userId: string, subscriptionData: any) {
    // let sub = await this.subscriptionRepo.findOne({ where: { organizationId } })
    // if (!sub) {
    //     sub = this.subscriptionRepo.create({ id: userId, organizationId, ...subscriptionData })
    // }
    // else {
    //   Object.assign(sub, subscriptionData)
    // }
    // return this.subscriptionRepo.save(sub)
  }

  async updateSubscription(organizationId: string, updateData: Partial<Subscription>) {
    await this.subscriptionRepo.update({ organizationId }, updateData)
  }

  //   async getCreditWallet(organizationId: string) {
  //     return this.creditWalletRepo.findOne({ where: { organizationId } })
  //   }

  async updateCredit(organizationId: string, amount: number) {
    // const wallet = await this.getCreditWallet(organizationId)
    // if (wallet) {
    //   wallet.balance += amount
    //   return this.creditWalletRepo.save(wallet)
    // }
    // return this.creditWalletRepo.save(
    //   this.creditWalletRepo.create({ organizationId, balance: amount }),
    // )
  }
}
