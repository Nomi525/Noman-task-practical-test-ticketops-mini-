import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATION_QUEUE, JobNames } from './notification-queue.service';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job<any>): Promise<void> {
    this.logger.log(`Processing job: ${job.name} [${job.id}]`);
    this.logger.debug(`Job data: ${JSON.stringify(job.data)}`);

    switch (job.name) {
      case JobNames.TICKET_CREATED:
        await this.handleTicketCreated(job.data);
        break;
      case JobNames.TICKET_STATUS_CHANGED:
        await this.handleStatusChanged(job.data);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleTicketCreated(data: { ticketId: string }) {
    // Mock: In production, send email/Slack/webhook notification
    this.logger.log(
      `[NOTIFICATION] Ticket created: ticketId=${data.ticketId}`,
    );
  }

  private async handleStatusChanged(data: {
    ticketId: string;
    from: string;
    to: string;
  }) {
    this.logger.log(
      `[NOTIFICATION] Status changed: ticketId=${data.ticketId}, ${data.from} → ${data.to}`,
    );
  }
}
