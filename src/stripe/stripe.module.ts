import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [UsersModule, SubscriptionsModule],
  controllers: [StripeController],
})
export class StripeModule {}
