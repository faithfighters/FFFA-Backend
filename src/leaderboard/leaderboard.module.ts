import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { CausesModule } from '../causes/causes.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { VotesModule } from '../votes/votes.module';

@Module({
  imports: [CausesModule, UsersModule, SubscriptionsModule, VotesModule],
  controllers: [LeaderboardController],
})
export class LeaderboardModule {}
