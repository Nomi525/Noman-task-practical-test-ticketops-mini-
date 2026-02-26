import { Tag } from './tag.entity';
import { TicketEvent } from './ticket-event.entity';
export declare enum TicketStatus {
    OPEN = "OPEN",
    IN_PROGRESS = "IN_PROGRESS",
    RESOLVED = "RESOLVED",
    CLOSED = "CLOSED"
}
export declare enum TicketPriority {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare class Ticket {
    id: string;
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    assigneeId: string;
    createdAt: Date;
    updatedAt: Date;
    tags: Tag[];
    events: TicketEvent[];
}
