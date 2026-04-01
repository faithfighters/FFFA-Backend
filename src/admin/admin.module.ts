import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { VideosModule } from '../videos/videos.module';
import { VotingCyclesModule } from '../voting-cycles/voting-cycles.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CausesModule } from '../causes/causes.module';
import { CharitiesModule } from '../charities/charities.module';
import { VotesModule } from '../votes/votes.module';

@Module({
  imports: [
    UsersModule,
    VideosModule,
    VotingCyclesModule,
    PayoutsModule,
    SubscriptionsModule,
    CausesModule,
    CharitiesModule,
    VotesModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
