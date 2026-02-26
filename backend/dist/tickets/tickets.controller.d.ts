import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
export declare class TicketsController {
    private readonly ticketsService;
    constructor(ticketsService: TicketsService);
    create(dto: CreateTicketDto, req: any, idempotencyKey?: string): Promise<{
        data: import("./entities/ticket.entity").Ticket;
        meta: {
            idempotent: boolean;
        };
    }>;
    findAll(query: ListTicketsDto): Promise<{
        data: import("./entities/ticket.entity").Ticket[];
        meta: {
            nextCursor: string;
        };
    }>;
    findOne(id: string): Promise<{
        data: {
            events: import("./entities/ticket-event.entity").TicketEvent[];
            id: string;
            title: string;
            description: string;
            status: import("./entities/ticket.entity").TicketStatus;
            priority: import("./entities/ticket.entity").TicketPriority;
            assigneeId: string;
            createdAt: Date;
            updatedAt: Date;
            tags: import("./entities/tag.entity").Tag[];
        };
    }>;
    updateStatus(id: string, dto: UpdateStatusDto, req: any): Promise<{
        data: import("./entities/ticket.entity").Ticket;
    }>;
}
