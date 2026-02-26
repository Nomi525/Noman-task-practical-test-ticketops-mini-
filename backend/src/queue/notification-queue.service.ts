import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const NOTIFICATION_QUEUE = 'notifications';

export const JobNames = {
  TICKET_CREATED: 'TicketCreated',
  TICKET_STATUS_CHANGED: 'TicketStatusChanged',
} as const;

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  async enqueueTicketCreated(ticketId: string, idempotencyKey?: string) {
    // Deterministic job ID prevents duplicate notifications
    const jobId = idempotencyKey
      ? `ticket_created:${idempotencyKey}`
      : `ticket_created:${ticketId}`;

    await this.queue.add(
      JobNames.TICKET_CREATED,
      { ticketId },
      {
        jobId,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    this.logger.log(`Enqueued TicketCreated job [${jobId}]`);
  }

  async enqueueStatusChanged(ticketId: string, from: string, to: string) {
    const jobId = `ticket_status:${ticketId}:${from}_${to}_${Date.now()}`;

    await this.queue.add(
      JobNames.TICKET_STATUS_CHANGED,
      { ticketId, from, to },
      {
        jobId,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    this.logger.log(`Enqueued TicketStatusChanged job [${jobId}]`);
  }
}
