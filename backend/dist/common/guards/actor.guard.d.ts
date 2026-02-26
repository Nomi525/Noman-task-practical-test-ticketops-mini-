import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class ActorGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
