import { Queue } from 'bullmq';
export declare const NOTIFICATION_QUEUE = "notifications";
export declare const JobNames: {
    readonly TICKET_CREATED: "TicketCreated";
    readonly TICKET_STATUS_CHANGED: "TicketStatusChanged";
};
export declare class NotificationQueueService {
    private readonly queue;
    private readonly logger;
    constructor(queue: Queue);
    enqueueTicketCreated(ticketId: string, idempotencyKey?: string): Promise<void>;
    enqueueStatusChanged(ticketId: string, from: string, to: string): Promise<void>;
}
