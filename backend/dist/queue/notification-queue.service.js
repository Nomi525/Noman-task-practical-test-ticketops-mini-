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
var NotificationQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationQueueService = exports.JobNames = exports.NOTIFICATION_QUEUE = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
exports.NOTIFICATION_QUEUE = 'notifications';
exports.JobNames = {
    TICKET_CREATED: 'TicketCreated',
    TICKET_STATUS_CHANGED: 'TicketStatusChanged',
};
let NotificationQueueService = NotificationQueueService_1 = class NotificationQueueService {
    constructor(queue) {
        this.queue = queue;
        this.logger = new common_1.Logger(NotificationQueueService_1.name);
    }
    async enqueueTicketCreated(ticketId, idempotencyKey) {
        const jobId = idempotencyKey
            ? `ticket_created:${idempotencyKey}`
            : `ticket_created:${ticketId}`;
        await this.queue.add(exports.JobNames.TICKET_CREATED, { ticketId }, {
            jobId,
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
        });
        this.logger.log(`Enqueued TicketCreated job [${jobId}]`);
    }
    async enqueueStatusChanged(ticketId, from, to) {
        const jobId = `ticket_status:${ticketId}:${from}_${to}_${Date.now()}`;
        await this.queue.add(exports.JobNames.TICKET_STATUS_CHANGED, { ticketId, from, to }, {
            jobId,
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
        });
        this.logger.log(`Enqueued TicketStatusChanged job [${jobId}]`);
    }
};
exports.NotificationQueueService = NotificationQueueService;
exports.NotificationQueueService = NotificationQueueService = NotificationQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(exports.NOTIFICATION_QUEUE)),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], NotificationQueueService);
//# sourceMappingURL=notification-queue.service.js.map