import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { Tag } from './entities/tag.entity';
import { TicketEvent, EventType } from './entities/ticket-event.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { NotificationQueueService } from '../queue/notification-queue.service';
import { log } from 'console';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private ticketRepo: Repository<Ticket>,
    @InjectRepository(Tag)
    private tagRepo: Repository<Tag>,
    @InjectRepository(TicketEvent)
    private eventRepo: Repository<TicketEvent>,
    @InjectRepository(IdempotencyKey)
    private idempotencyRepo: Repository<IdempotencyKey>,
    private dataSource: DataSource,
    private notificationQueue: NotificationQueueService,
  ) {}

  // ─── Idempotency helpers ────────────────────────────────────────────

  private hashPayload(payload: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private async checkIdempotency(
    key: string,
    hash: string,
  ): Promise<IdempotencyKey | null> {
    const record = await this.idempotencyRepo.findOne({ where: { key } });
    if (!record) return null;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (record.createdAt < tenMinutesAgo) {
      // Expired — allow re-use
      await this.idempotencyRepo.delete({ key });
      return null;
    }

    if (record.requestHash !== hash) {
      throw new BadRequestException(
        'Idempotency key already used with a different payload',
      );
    }

    return record;
  }

  // ─── Upsert tags ────────────────────────────────────────────────────

  private async upsertTags(names: string[]): Promise<Tag[]> {
    if (!names || names.length === 0) return [];

    const tags: Tag[] = [];
    for (const name of names) {
      const normalized = name.trim().toLowerCase();
      let tag = await this.tagRepo.findOne({ where: { name: normalized } });
      if (!tag) {
        tag = this.tagRepo.create({ name: normalized });
        tag = await this.tagRepo.save(tag);
      }
      tags.push(tag);
    }
    return tags;
  }

  // ─── Create Ticket ──────────────────────────────────────────────────

  async create(
    dto: CreateTicketDto,
    actor: string,
    role: string,
    idempotencyKey?: string,
  ) {

    console.log(dto, "dto")
    console.log(role, "role")

    // RBAC: only admin can assign
    if (dto.assigneeId && role !== 'admin') {
      throw new ForbiddenException('Only admin can assign tickets');
    }

    const hash = this.hashPayload(dto);

    // Idempotency check
    if (idempotencyKey) {
      const existing = await this.checkIdempotency(idempotencyKey, hash);
      if (existing) {
        const ticket = await this.ticketRepo.findOne({
          where: { id: existing.responseRef },
          relations: ['tags'],
        });
        return { ticket, idempotent: true };
      }
    }

    
    // Transaction: create ticket + tags + event
    const ticket = await this.dataSource.transaction(async (manager) => {
      const tags = await this.upsertTags(dto.tags || []);

      const t = manager.create(Ticket, {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        assigneeId: dto.assigneeId || null,
        status: TicketStatus.OPEN,
        tags,
      });
      const saved = await manager.save(Ticket, t);

      // Audit event
      const event = manager.create(TicketEvent, {
        ticketId: saved.id,
        actor,
        eventType: EventType.CREATED,
        meta: { title: dto.title, priority: dto.priority },
      });
      await manager.save(TicketEvent, event);

      return saved;
    });

    // Store idempotency record
    if (idempotencyKey) {
      const record = this.idempotencyRepo.create({
        key: idempotencyKey,
        requestHash: hash,
        responseRef: ticket.id,
      });
      await this.idempotencyRepo.save(record);
    }

    // Enqueue notification (dedupe by ticket id)
    await this.notificationQueue.enqueueTicketCreated(ticket.id, idempotencyKey);

    const result = await this.ticketRepo.findOne({
      where: { id: ticket.id },
      relations: ['tags'],
    });

    return { ticket: result, idempotent: false };
  }

  // ─── List Tickets (cursor pagination) ───────────────────────────────

  async findAll(query: ListTicketsDto) {
    const limit = query.limit || 20;

    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.tags', 'tag');

    // Filters
    if (query.status) {
      qb.andWhere('t.status = :status', { status: query.status });
    }
    if (query.assigneeId) {
      qb.andWhere('t.assigneeId = :assigneeId', { assigneeId: query.assigneeId });
    }
    if (query.q) {
      qb.andWhere('t.title ILIKE :q', { q: `%${query.q}%` });
    }
    if (query.from) {
      qb.andWhere('t.createdAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('t.createdAt <= :to', { to: new Date(query.to) });
    }
    if (query.tag) {
      qb.andWhere('tag.name = :tagName', { tagName: query.tag.toLowerCase() });
    }

    // Cursor-based pagination
    // cursor encodes: { createdAt, id }
    if (query.cursor) {
      try {
        const { createdAt, id } = JSON.parse(
          Buffer.from(query.cursor, 'base64').toString('utf8'),
        );
        qb.andWhere(
          '(t.createdAt < :cursorDate OR (t.createdAt = :cursorDate AND t.id < :cursorId))',
          { cursorDate: new Date(createdAt), cursorId: id },
        );
      } catch {
        throw new BadRequestException('Invalid cursor');
      }
    }

    // Stable sort: createdAt DESC, id DESC
    qb.orderBy('t.createdAt', 'DESC').addOrderBy('t.id', 'DESC');

    // Fetch limit+1 to detect next page
    const rows = await qb.take(limit + 1).getMany();

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      rows.pop();
      const last = rows[rows.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: last.createdAt, id: last.id }),
      ).toString('base64');
    }

    return {
      data: rows,
      meta: { nextCursor },
    };
  }

  // ─── Get Single Ticket ───────────────────────────────────────────────

  async findOne(id: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['tags'],
    });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);

    const events = await this.eventRepo.find({
      where: { ticketId: id },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return { ...ticket, events };
  }

  // ─── Update Status ───────────────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateStatusDto, actor: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);

    const from = ticket.status;
    const to = dto.status;

    if (from === to) {
      return ticket;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Ticket, { id }, { status: to });

      const event = manager.create(TicketEvent, {
        ticketId: id,
        actor,
        eventType: EventType.STATUS_CHANGED,
        meta: { from, to },
      });
      await manager.save(TicketEvent, event);
    });

    // Enqueue notification
    await this.notificationQueue.enqueueStatusChanged(id, from, to);

    return this.ticketRepo.findOne({ where: { id }, relations: ['tags'] });
  }
}
