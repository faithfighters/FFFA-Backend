import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!['admin', 'moderator'].includes(req.user?.role)) throw new ForbiddenException('Admin or moderator only.');
    return true;
  }
}
