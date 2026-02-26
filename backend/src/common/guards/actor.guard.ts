import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ActorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const actor = request.headers['x-actor'];

    if (!actor || typeof actor !== 'string' || actor.trim() === '') {
      throw new BadRequestException('X-Actor header is required for write operations');
    }

    request.actor = actor.trim();
    request.role = (request.headers['x-role'] || 'user').toLowerCase();

    return true;
  }
}
