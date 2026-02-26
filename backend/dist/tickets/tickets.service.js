"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto = require("crypto");
const ticket_entity_1 = require("./entities/ticket.entity");
const tag_entity_1 = require("./entities/tag.entity");
const ticket_event_entity_1 = require("./entities/ticket-event.entity");
const idempotency_key_entity_1 = require("./entities/idempotency-key.entity");
const notification_queue_service_1 = require("../queue/notification-queue.service");
let TicketsService = class TicketsService {
    constructor(ticketRepo, tagRepo, eventRepo, idempotencyRepo, dataSource, notificationQueue) {
        this.ticketRepo = ticketRepo;
        this.tagRepo = tagRepo;
        this.eventRepo = eventRepo;
        this.idempotencyRepo = idempotencyRepo;
        this.dataSource = dataSource;
        this.notificationQueue = notificationQueue;
    }
    hashPayload(payload) {
        return crypto
            .createHash('sha256')
            .update(JSON.stringify(payload))
            .digest('hex');
    }
    async checkIdempotency(key, hash) {
        const record = await this.idempotencyRepo.findOne({ where: { key } });
        if (!record)
            return null;
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (record.createdAt < tenMinutesAgo) {
            await this.idempotencyRepo.delete({ key });
            return null;
        }
        if (record.requestHash !== hash) {
            throw new common_1.BadRequestException('Idempotency key already used with a different payload');
        }
        return record;
    }
    async upsertTags(names) {
        if (!names || names.length === 0)
            return [];
        const tags = [];
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
    async create(dto, actor, role, idempotencyKey) {
        console.log(dto, "dto");
        if (dto.assigneeId && role !== 'admin') {
            throw new common_1.ForbiddenException('Only admin can assign tickets');
        }
        const hash = this.hashPayload(dto);
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
        const ticket = await this.dataSource.transaction(async (manager) => {
            const tags = await this.upsertTags(dto.tags || []);
            const t = manager.create(ticket_entity_1.Ticket, {
                title: dto.title,
                description: dto.description,
                priority: dto.priority,
                assigneeId: dto.assigneeId || null,
                status: ticket_entity_1.TicketStatus.OPEN,
                tags,
            });
            const saved = await manager.save(ticket_entity_1.Ticket, t);
            const event = manager.create(ticket_event_entity_1.TicketEvent, {
                ticketId: saved.id,
                actor,
                eventType: ticket_event_entity_1.EventType.CREATED,
                meta: { title: dto.title, priority: dto.priority },
            });
            await manager.save(ticket_event_entity_1.TicketEvent, event);
            return saved;
        });
        if (idempotencyKey) {
            const record = this.idempotencyRepo.create({
                key: idempotencyKey,
                requestHash: hash,
                responseRef: ticket.id,
            });
            await this.idempotencyRepo.save(record);
        }
        await this.notificationQueue.enqueueTicketCreated(ticket.id, idempotencyKey);
        const result = await this.ticketRepo.findOne({
            where: { id: ticket.id },
            relations: ['tags'],
        });
        return { ticket: result, idempotent: false };
    }
    async findAll(query) {
        const limit = query.limit || 20;
        const qb = this.ticketRepo
            .createQueryBuilder('t')
            .leftJoinAndSelect('t.tags', 'tag');
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
        if (query.cursor) {
            try {
                const { createdAt, id } = JSON.parse(Buffer.from(query.cursor, 'base64').toString('utf8'));
                qb.andWhere('(t.createdAt < :cursorDate OR (t.createdAt = :cursorDate AND t.id < :cursorId))', { cursorDate: new Date(createdAt), cursorId: id });
            }
            catch {
                throw new common_1.BadRequestException('Invalid cursor');
            }
        }
        qb.orderBy('t.createdAt', 'DESC').addOrderBy('t.id', 'DESC');
        const rows = await qb.take(limit + 1).getMany();
        let nextCursor = null;
        if (rows.length > limit) {
            rows.pop();
            const last = rows[rows.length - 1];
            nextCursor = Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString('base64');
        }
        return {
            data: rows,
            meta: { nextCursor },
        };
    }
    async findOne(id) {
        const ticket = await this.ticketRepo.findOne({
            where: { id },
            relations: ['tags'],
        });
        if (!ticket)
            throw new common_1.NotFoundException(`Ticket ${id} not found`);
        const events = await this.eventRepo.find({
            where: { ticketId: id },
            order: { createdAt: 'DESC' },
            take: 20,
        });
        return { ...ticket, events };
    }
    async updateStatus(id, dto, actor) {
        const ticket = await this.ticketRepo.findOne({ where: { id } });
        if (!ticket)
            throw new common_1.NotFoundException(`Ticket ${id} not found`);
        const from = ticket.status;
        const to = dto.status;
        if (from === to) {
            return ticket;
        }
        await this.dataSource.transaction(async (manager) => {
            await manager.update(ticket_entity_1.Ticket, { id }, { status: to });
            const event = manager.create(ticket_event_entity_1.TicketEvent, {
                ticketId: id,
                actor,
                eventType: ticket_event_entity_1.EventType.STATUS_CHANGED,
                meta: { from, to },
            });
            await manager.save(ticket_event_entity_1.TicketEvent, event);
        });
        await this.notificationQueue.enqueueStatusChanged(id, from, to);
        return this.ticketRepo.findOne({ where: { id }, relations: ['tags'] });
    }
};
exports.TicketsService = TicketsService;
exports.TicketsService = TicketsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ticket_entity_1.Ticket)),
    __param(1, (0, typeorm_1.InjectRepository)(tag_entity_1.Tag)),
    __param(2, (0, typeorm_1.InjectRepository)(ticket_event_entity_1.TicketEvent)),
    __param(3, (0, typeorm_1.InjectRepository)(idempotency_key_entity_1.IdempotencyKey)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        notification_queue_service_1.NotificationQueueService])
], TicketsService);
//# sourceMappingURL=tickets.service.js.map