import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationQueueService, NOTIFICATION_QUEUE } from './notification-queue.service';
import { NotificationProcessor } from './notification.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  providers: [NotificationQueueService, NotificationProcessor],
  exports: [NotificationQueueService],
})
export class QueueModule {}
