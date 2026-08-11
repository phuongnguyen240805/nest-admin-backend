import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { DomainEventOutboxService } from './domain-event-outbox.service'
import { DomainOutboxEventEntity } from './entities/domain-outbox-event.entity'

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DomainOutboxEventEntity])],
  providers: [DomainEventOutboxService],
  exports: [DomainEventOutboxService, TypeOrmModule],
})
export class DomainEventsModule {}
