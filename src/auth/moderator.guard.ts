import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Allows access to Admin and Moderator roles only.
 * Moderators can review content but cannot manage finances.
 */
@Injectable()
export class ModeratorGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!['admin', 'moderator'].includes(req.user?.role)) {
      throw new ForbiddenException('Moderator or Admin access required.');
    }
    return true;
  }
}
