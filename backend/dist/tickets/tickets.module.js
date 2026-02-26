"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const tickets_controller_1 = require("./tickets.controller");
const tickets_service_1 = require("./tickets.service");
const ticket_entity_1 = require("./entities/ticket.entity");
const tag_entity_1 = require("./entities/tag.entity");
const ticket_event_entity_1 = require("./entities/ticket-event.entity");
const idempotency_key_entity_1 = require("./entities/idempotency-key.entity");
const queue_module_1 = require("../queue/queue.module");
let TicketsModule = class TicketsModule {
};
exports.TicketsModule = TicketsModule;
exports.TicketsModule = TicketsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([ticket_entity_1.Ticket, tag_entity_1.Tag, ticket_event_entity_1.TicketEvent, idempotency_key_entity_1.IdempotencyKey]),
            queue_module_1.QueueModule,
        ],
        controllers: [tickets_controller_1.TicketsController],
        providers: [tickets_service_1.TicketsService],
        exports: [tickets_service_1.TicketsService],
    })
], TicketsModule);
//# sourceMappingURL=tickets.module.js.map