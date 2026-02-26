"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tickets_service_1 = require("../tickets.service");
const ticket_entity_1 = require("../entities/ticket.entity");
const tag_entity_1 = require("../entities/tag.entity");
const ticket_event_entity_1 = require("../entities/ticket-event.entity");
const idempotency_key_entity_1 = require("../entities/idempotency-key.entity");
const notification_queue_service_1 = require("../../queue/notification-queue.service");
const mockTicket = {
    id: 'test-uuid-1234',
    title: 'Test Ticket',
    description: 'Test description',
    status: ticket_entity_1.TicketStatus.OPEN,
    priority: ticket_entity_1.TicketPriority.HIGH,
    assigneeId: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    tags: [],
};
const makeRepoMock = (overrides = {}) => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
    }),
    update: jest.fn(),
    ...overrides,
});
const makeDataSourceMock = (overrides = {}) => ({
    transaction: jest.fn().mockImplementation(async (cb) => cb({
        create: jest.fn().mockImplementation((Entity, data) => ({ ...data })),
        save: jest.fn().mockImplementation(async (Entity, data) => ({
            ...data,
            id: 'test-uuid-1234',
        })),
        update: jest.fn(),
    })),
    ...overrides,
});
describe('TicketsService', () => {
    let service;
    let ticketRepo;
    let tagRepo;
    let eventRepo;
    let idempotencyRepo;
    let notificationQueue;
    let dataSource;
    beforeEach(async () => {
        ticketRepo = makeRepoMock();
        tagRepo = makeRepoMock();
        eventRepo = makeRepoMock();
        idempotencyRepo = makeRepoMock();
        dataSource = makeDataSourceMock();
        notificationQueue = {
            enqueueTicketCreated: jest.fn().mockResolvedValue(undefined),
            enqueueStatusChanged: jest.fn().mockResolvedValue(undefined),
        };
        const module = await testing_1.Test.createTestingModule({
            providers: [
                tickets_service_1.TicketsService,
                { provide: (0, typeorm_1.getRepositoryToken)(ticket_entity_1.Ticket), useValue: ticketRepo },
                { provide: (0, typeorm_1.getRepositoryToken)(tag_entity_1.Tag), useValue: tagRepo },
                { provide: (0, typeorm_1.getRepositoryToken)(ticket_event_entity_1.TicketEvent), useValue: eventRepo },
                { provide: (0, typeorm_1.getRepositoryToken)(idempotency_key_entity_1.IdempotencyKey), useValue: idempotencyRepo },
                { provide: typeorm_2.DataSource, useValue: dataSource },
                { provide: notification_queue_service_1.NotificationQueueService, useValue: notificationQueue },
            ],
        }).compile();
        service = module.get(tickets_service_1.TicketsService);
    });
    describe('create()', () => {
        it('should create a ticket, write an audit event, and return the ticket', async () => {
            const dto = {
                title: 'Bug: Login fails',
                description: 'Cannot log in with correct credentials',
                priority: ticket_entity_1.TicketPriority.HIGH,
                tags: ['bug', 'auth'],
            };
            tagRepo.findOne.mockResolvedValue(null);
            tagRepo.create.mockImplementation((data) => data);
            tagRepo.save.mockImplementation(async (data) => ({
                ...data,
                id: `tag-${data.name}`,
            }));
            ticketRepo.findOne.mockResolvedValue({
                ...mockTicket,
                title: dto.title,
                tags: [
                    { id: 'tag-bug', name: 'bug' },
                    { id: 'tag-auth', name: 'auth' },
                ],
            });
            idempotencyRepo.findOne.mockResolvedValue(null);
            idempotencyRepo.create.mockImplementation((data) => data);
            idempotencyRepo.save.mockResolvedValue(undefined);
            const result = await service.create(dto, 'alice', 'user', 'key-001');
            expect(result.ticket).toBeDefined();
            expect(result.ticket.title).toBe(dto.title);
            expect(result.ticket.tags).toHaveLength(2);
            expect(dataSource.transaction).toHaveBeenCalledTimes(1);
            expect(notificationQueue.enqueueTicketCreated).toHaveBeenCalledWith(expect.any(String), 'key-001');
        });
    });
    describe('findAll()', () => {
        it('should return tickets with nextCursor when there are more results', async () => {
            const tickets = Array.from({ length: 21 }, (_, i) => ({
                ...mockTicket,
                id: `uuid-${i}`,
                title: `Ticket ${i}`,
                createdAt: new Date(`2024-01-${(i + 1).toString().padStart(2, '0')}T00:00:00Z`),
                tags: [],
            }));
            const qb = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                addOrderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(tickets),
            };
            ticketRepo.createQueryBuilder.mockReturnValue(qb);
            const result = await service.findAll({ limit: 20 });
            expect(result.data).toHaveLength(20);
            expect(result.meta.nextCursor).toBeTruthy();
            const decoded = JSON.parse(Buffer.from(result.meta.nextCursor, 'base64').toString('utf8'));
            expect(decoded).toHaveProperty('createdAt');
            expect(decoded).toHaveProperty('id');
        });
        it('should return null nextCursor when no more results', async () => {
            const qb = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                addOrderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([mockTicket]),
            };
            ticketRepo.createQueryBuilder.mockReturnValue(qb);
            const result = await service.findAll({ limit: 20 });
            expect(result.meta.nextCursor).toBeNull();
        });
    });
    describe('updateStatus()', () => {
        it('should update status, create an audit event with from/to, and enqueue notification', async () => {
            const existingTicket = {
                ...mockTicket,
                status: ticket_entity_1.TicketStatus.OPEN,
            };
            ticketRepo.findOne
                .mockResolvedValueOnce(existingTicket)
                .mockResolvedValueOnce({ ...existingTicket, status: ticket_entity_1.TicketStatus.IN_PROGRESS, tags: [] });
            const transactionMock = jest.fn().mockImplementation(async (cb) => {
                const manager = {
                    create: jest.fn().mockImplementation((Entity, data) => data),
                    save: jest.fn().mockResolvedValue(undefined),
                    update: jest.fn().mockResolvedValue(undefined),
                };
                return cb(manager);
            });
            dataSource.transaction = transactionMock;
            const result = await service.updateStatus(mockTicket.id, { status: ticket_entity_1.TicketStatus.IN_PROGRESS }, 'bob');
            expect(dataSource.transaction).toHaveBeenCalledTimes(1);
            const managerArg = transactionMock.mock.calls[0][0];
            const mockManager = {
                create: jest.fn().mockImplementation((Entity, data) => data),
                save: jest.fn().mockResolvedValue(undefined),
                update: jest.fn().mockResolvedValue(undefined),
            };
            await managerArg(mockManager);
            expect(mockManager.create).toHaveBeenCalledWith(ticket_event_entity_1.TicketEvent, expect.objectContaining({
                eventType: ticket_event_entity_1.EventType.STATUS_CHANGED,
                meta: {
                    from: ticket_entity_1.TicketStatus.OPEN,
                    to: ticket_entity_1.TicketStatus.IN_PROGRESS,
                },
                actor: 'bob',
            }));
            expect(notificationQueue.enqueueStatusChanged).toHaveBeenCalledWith(mockTicket.id, ticket_entity_1.TicketStatus.OPEN, ticket_entity_1.TicketStatus.IN_PROGRESS);
        });
    });
    describe('idempotency', () => {
        it('should return existing ticket and NOT enqueue again on duplicate key', async () => {
            const dto = {
                title: 'Existing ticket',
                priority: ticket_entity_1.TicketPriority.MEDIUM,
            };
            const existingRecord = {
                key: 'duplicate-key',
                requestHash: '',
                responseRef: mockTicket.id,
                createdAt: new Date(),
            };
            const crypto = require('crypto');
            existingRecord.requestHash = crypto
                .createHash('sha256')
                .update(JSON.stringify(dto))
                .digest('hex');
            idempotencyRepo.findOne.mockResolvedValue(existingRecord);
            ticketRepo.findOne.mockResolvedValue({ ...mockTicket, tags: [] });
            const result = await service.create(dto, 'alice', 'user', 'duplicate-key');
            expect(result.ticket.id).toBe(mockTicket.id);
            expect(result.idempotent).toBe(true);
            expect(dataSource.transaction).not.toHaveBeenCalled();
            expect(notificationQueue.enqueueTicketCreated).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=tickets.service.spec.js.map