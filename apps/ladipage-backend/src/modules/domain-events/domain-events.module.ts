import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { DomainEventDeliveryService } from './domain-event-delivery.service'
import { DomainEventOutboxService } from './domain-event-outbox.service'
import { DomainEventDeliveryEntity } from './entities/domain-event-delivery.entity'
import { DomainOutboxEventEntity } from './entities/domain-outbox-event.entity'

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DomainOutboxEventEntity, DomainEventDeliveryEntity])],
  providers: [DomainEventOutboxService, DomainEventDeliveryService],
  exports: [DomainEventOutboxService, DomainEventDeliveryService, TypeOrmModule],
})
export class DomainEventsModule {}
