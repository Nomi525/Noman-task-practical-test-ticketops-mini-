import { TicketPriority } from '../entities/ticket.entity';
export declare class CreateTicketDto {
    title: string;
    description?: string;
    priority: TicketPriority;
    assigneeId?: string;
    tags?: string[];
}
