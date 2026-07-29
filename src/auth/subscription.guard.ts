import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

/** Blocks recipients (free "need help" signups) from paywalled content until they hold an active plan. Donors always pass. */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Authentication required.');

    const user = await this.usersService.findById(userId);
    if (!user) throw new ForbiddenException('Authentication required.');

    if (user.userType === 'recipient' && !user.plan) {
      throw new ForbiddenException('An active membership is required to access this content.');
    }
    return true;
  }
}
