import { Ticket } from './ticket.entity';
export declare enum EventType {
    CREATED = "CREATED",
    STATUS_CHANGED = "STATUS_CHANGED",
    ASSIGNED = "ASSIGNED",
    UPDATED = "UPDATED"
}
export declare class TicketEvent {
    id: string;
    ticketId: string;
    ticket: Ticket;
    actor: string;
    eventType: EventType;
    meta: Record<string, any>;
    createdAt: Date;
}
