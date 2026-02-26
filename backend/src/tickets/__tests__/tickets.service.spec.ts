import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TicketsService } from '../tickets.service';
import { Ticket, TicketStatus, TicketPriority } from '../entities/ticket.entity';
import { Tag } from '../entities/tag.entity';
import { TicketEvent, EventType } from '../entities/ticket-event.entity';
import { IdempotencyKey } from '../entities/idempotency-key.entity';
import { NotificationQueueService } from '../../queue/notification-queue.service';

// ─── Mock helpers ─────────────────────────────────────────────────────

const mockTicket: Partial<Ticket> = {
  id: 'test-uuid-1234',
  title: 'Test Ticket',
  description: 'Test description',
  status: TicketStatus.OPEN,
  priority: TicketPriority.HIGH,
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
  transaction: jest.fn().mockImplementation(async (cb) =>
    cb({
      create: jest.fn().mockImplementation((Entity, data) => ({ ...data })),
      save: jest.fn().mockImplementation(async (Entity, data) => ({
        ...data,
        id: 'test-uuid-1234',
      })),
      update: jest.fn(),
    }),
  ),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────

describe('TicketsService', () => {
  let service: TicketsService;
  let ticketRepo: ReturnType<typeof makeRepoMock>;
  let tagRepo: ReturnType<typeof makeRepoMock>;
  let eventRepo: ReturnType<typeof makeRepoMock>;
  let idempotencyRepo: ReturnType<typeof makeRepoMock>;
  let notificationQueue: jest.Mocked<NotificationQueueService>;
  let dataSource: ReturnType<typeof makeDataSourceMock>;

  beforeEach(async () => {
    ticketRepo = makeRepoMock();
    tagRepo = makeRepoMock();
    eventRepo = makeRepoMock();
    idempotencyRepo = makeRepoMock();
    dataSource = makeDataSourceMock();

    notificationQueue = {
      enqueueTicketCreated: jest.fn().mockResolvedValue(undefined),
      enqueueStatusChanged: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: getRepositoryToken(Tag), useValue: tagRepo },
        { provide: getRepositoryToken(TicketEvent), useValue: eventRepo },
        { provide: getRepositoryToken(IdempotencyKey), useValue: idempotencyRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: NotificationQueueService, useValue: notificationQueue },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  // ─── Test 1: Create ticket success ────────────────────────────────

  describe('create()', () => {
    it('should create a ticket, write an audit event, and return the ticket', async () => {
      const dto = {
        title: 'Bug: Login fails',
        description: 'Cannot log in with correct credentials',
        priority: TicketPriority.HIGH,
        tags: ['bug', 'auth'],
      };

      // Tag repo: no existing tags → create new ones
      tagRepo.findOne.mockResolvedValue(null);
      tagRepo.create.mockImplementation((data) => data);
      tagRepo.save.mockImplementation(async (data) => ({
        ...data,
        id: `tag-${data.name}`,
      }));

      // After create, findOne returns the full ticket with relations
      ticketRepo.findOne.mockResolvedValue({
        ...mockTicket,
        title: dto.title,
        tags: [
          { id: 'tag-bug', name: 'bug' },
          { id: 'tag-auth', name: 'auth' },
        ],
      });

      // Idempotency: no existing key
      idempotencyRepo.findOne.mockResolvedValue(null);
      idempotencyRepo.create.mockImplementation((data) => data);
      idempotencyRepo.save.mockResolvedValue(undefined);

      const result = await service.create(dto, 'alice', 'user', 'key-001');

      expect(result.ticket).toBeDefined();
      expect(result.ticket.title).toBe(dto.title);
      expect(result.ticket.tags).toHaveLength(2);

      // Verify transaction was called (which writes the event)
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      // Verify notification was enqueued
      expect(notificationQueue.enqueueTicketCreated).toHaveBeenCalledWith(
        expect.any(String),
        'key-001',
      );
    });
  });

  // ─── Test 2: List tickets returns pagination meta ─────────────────

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
        getMany: jest.fn().mockResolvedValue(tickets), // limit+1 items → triggers nextCursor
      };

      ticketRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.meta.nextCursor).toBeTruthy();

      // Verify cursor is valid base64
      const decoded = JSON.parse(
        Buffer.from(result.meta.nextCursor, 'base64').toString('utf8'),
      );
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
        getMany: jest.fn().mockResolvedValue([mockTicket]), // only 1 item, limit=20
      };

      ticketRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ limit: 20 });

      expect(result.meta.nextCursor).toBeNull();
    });
  });

  // ─── Test 3: Status change creates event ──────────────────────────

  describe('updateStatus()', () => {
    it('should update status, create an audit event with from/to, and enqueue notification', async () => {
      const existingTicket = {
        ...mockTicket,
        status: TicketStatus.OPEN,
      };

      ticketRepo.findOne
        .mockResolvedValueOnce(existingTicket) // first call to get current ticket
        .mockResolvedValueOnce({ ...existingTicket, status: TicketStatus.IN_PROGRESS, tags: [] }); // final return

      const transactionMock = jest.fn().mockImplementation(async (cb) => {
        const manager = {
          create: jest.fn().mockImplementation((Entity, data) => data),
          save: jest.fn().mockResolvedValue(undefined),
          update: jest.fn().mockResolvedValue(undefined),
        };
        return cb(manager);
      });
      dataSource.transaction = transactionMock;

      const result = await service.updateStatus(
        mockTicket.id,
        { status: TicketStatus.IN_PROGRESS },
        'bob',
      );

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      // Verify the transaction manager created the event with correct meta
      const managerArg = transactionMock.mock.calls[0][0];
      const mockManager = {
        create: jest.fn().mockImplementation((Entity, data) => data),
        save: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      };
      await managerArg(mockManager);

      // Check that event was created with STATUS_CHANGED and from/to
      expect(mockManager.create).toHaveBeenCalledWith(
        TicketEvent,
        expect.objectContaining({
          eventType: EventType.STATUS_CHANGED,
          meta: {
            from: TicketStatus.OPEN,
            to: TicketStatus.IN_PROGRESS,
          },
          actor: 'bob',
        }),
      );

      // Notification should be enqueued
      expect(notificationQueue.enqueueStatusChanged).toHaveBeenCalledWith(
        mockTicket.id,
        TicketStatus.OPEN,
        TicketStatus.IN_PROGRESS,
      );
    });
  });

  // ─── Test 4: Idempotency prevents duplicate create + enqueue ──────

  describe('idempotency', () => {
    it('should return existing ticket and NOT enqueue again on duplicate key', async () => {
      const dto = {
        title: 'Existing ticket',
        priority: TicketPriority.MEDIUM,
      };

      // Simulate existing idempotency record within 10 mins
      const existingRecord = {
        key: 'duplicate-key',
        requestHash: '', // will be filled by service's hash logic
        responseRef: mockTicket.id,
        createdAt: new Date(), // fresh record
      };

      // We need to compute the same hash the service would compute
      const crypto = require('crypto');
      existingRecord.requestHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(dto))
        .digest('hex');

      idempotencyRepo.findOne.mockResolvedValue(existingRecord);

      // Ticket lookup for the existing ticket
      ticketRepo.findOne.mockResolvedValue({ ...mockTicket, tags: [] });

      const result = await service.create(dto, 'alice', 'user', 'duplicate-key');

      // Should return existing ticket
      expect(result.ticket.id).toBe(mockTicket.id);
      expect(result.idempotent).toBe(true);

      // Should NOT have run the transaction (no new ticket created)
      expect(dataSource.transaction).not.toHaveBeenCalled();

      // Should NOT enqueue a new notification
      expect(notificationQueue.enqueueTicketCreated).not.toHaveBeenCalled();
    });
  });
});



