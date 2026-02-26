import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { Tag } from './entities/tag.entity';
import { TicketEvent } from './entities/ticket-event.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, Tag, TicketEvent, IdempotencyKey]),
    QueueModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
