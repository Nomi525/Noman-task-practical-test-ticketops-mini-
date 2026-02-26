import { TicketStatus } from '../entities/ticket.entity';
export declare class ListTicketsDto {
    status?: TicketStatus;
    assigneeId?: string;
    tag?: string;
    q?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
}
