"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var NotificationProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const notification_queue_service_1 = require("./notification-queue.service");
let NotificationProcessor = NotificationProcessor_1 = class NotificationProcessor extends bullmq_1.WorkerHost {
    constructor() {
        super(...arguments);
        this.logger = new common_1.Logger(NotificationProcessor_1.name);
    }
    async process(job) {
        this.logger.log(`Processing job: ${job.name} [${job.id}]`);
        this.logger.debug(`Job data: ${JSON.stringify(job.data)}`);
        switch (job.name) {
            case notification_queue_service_1.JobNames.TICKET_CREATED:
                await this.handleTicketCreated(job.data);
                break;
            case notification_queue_service_1.JobNames.TICKET_STATUS_CHANGED:
                await this.handleStatusChanged(job.data);
                break;
            default:
                this.logger.warn(`Unknown job name: ${job.name}`);
        }
    }
    async handleTicketCreated(data) {
        this.logger.log(`[NOTIFICATION] Ticket created: ticketId=${data.ticketId}`);
    }
    async handleStatusChanged(data) {
        this.logger.log(`[NOTIFICATION] Status changed: ticketId=${data.ticketId}, ${data.from} → ${data.to}`);
    }
};
exports.NotificationProcessor = NotificationProcessor;
exports.NotificationProcessor = NotificationProcessor = NotificationProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(notification_queue_service_1.NOTIFICATION_QUEUE)
], NotificationProcessor);
//# sourceMappingURL=notification.processor.js.map