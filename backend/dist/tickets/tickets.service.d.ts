import { Repository, DataSource } from 'typeorm';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { Tag } from './entities/tag.entity';
import { TicketEvent } from './entities/ticket-event.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { NotificationQueueService } from '../queue/notification-queue.service';
export declare class TicketsService {
    private ticketRepo;
    private tagRepo;
    private eventRepo;
    private idempotencyRepo;
    private dataSource;
    private notificationQueue;
    constructor(ticketRepo: Repository<Ticket>, tagRepo: Repository<Tag>, eventRepo: Repository<TicketEvent>, idempotencyRepo: Repository<IdempotencyKey>, dataSource: DataSource, notificationQueue: NotificationQueueService);
    private hashPayload;
    private checkIdempotency;
    private upsertTags;
    create(dto: CreateTicketDto, actor: string, role: string, idempotencyKey?: string): Promise<{
        ticket: Ticket;
        idempotent: boolean;
    }>;
    findAll(query: ListTicketsDto): Promise<{
        data: Ticket[];
        meta: {
            nextCursor: string;
        };
    }>;
    findOne(id: string): Promise<{
        events: TicketEvent[];
        id: string;
        title: string;
        description: string;
        status: TicketStatus;
        priority: import("./entities/ticket.entity").TicketPriority;
        assigneeId: string;
        createdAt: Date;
        updatedAt: Date;
        tags: Tag[];
    }>;
    updateStatus(id: string, dto: UpdateStatusDto, actor: string): Promise<Ticket>;
}
