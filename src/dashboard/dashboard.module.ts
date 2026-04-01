import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { UsersModule } from '../users/users.module';
import { VotingCyclesModule } from '../voting-cycles/voting-cycles.module';
import { VotesModule } from '../votes/votes.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [UsersModule, VotingCyclesModule, VotesModule, SubscriptionsModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
