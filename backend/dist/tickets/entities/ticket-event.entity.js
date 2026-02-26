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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketEvent = exports.EventType = void 0;
const typeorm_1 = require("typeorm");
const ticket_entity_1 = require("./ticket.entity");
var EventType;
(function (EventType) {
    EventType["CREATED"] = "CREATED";
    EventType["STATUS_CHANGED"] = "STATUS_CHANGED";
    EventType["ASSIGNED"] = "ASSIGNED";
    EventType["UPDATED"] = "UPDATED";
})(EventType || (exports.EventType = EventType = {}));
let TicketEvent = class TicketEvent {
};
exports.TicketEvent = TicketEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TicketEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], TicketEvent.prototype, "ticketId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ticket_entity_1.Ticket, (ticket) => ticket.events, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ticket_id' }),
    __metadata("design:type", ticket_entity_1.Ticket)
], TicketEvent.prototype, "ticket", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], TicketEvent.prototype, "actor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: EventType }),
    __metadata("design:type", String)
], TicketEvent.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], TicketEvent.prototype, "meta", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], TicketEvent.prototype, "createdAt", void 0);
exports.TicketEvent = TicketEvent = __decorate([
    (0, typeorm_1.Entity)('ticket_events'),
    (0, typeorm_1.Index)('idx_ticket_events_ticket_id', ['ticketId'])
], TicketEvent);
//# sourceMappingURL=ticket-event.entity.js.map