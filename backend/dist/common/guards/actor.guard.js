"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActorGuard = void 0;
const common_1 = require("@nestjs/common");
let ActorGuard = class ActorGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const actor = request.headers['x-actor'];
        if (!actor || typeof actor !== 'string' || actor.trim() === '') {
            throw new common_1.BadRequestException('X-Actor header is required for write operations');
        }
        request.actor = actor.trim();
        request.role = (request.headers['x-role'] || 'user').toLowerCase();
        return true;
    }
};
exports.ActorGuard = ActorGuard;
exports.ActorGuard = ActorGuard = __decorate([
    (0, common_1.Injectable)()
], ActorGuard);
//# sourceMappingURL=actor.guard.js.map