import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CausesModule } from './causes/causes.module';
import { VideosModule } from './videos/videos.module';
import { VotesModule } from './votes/votes.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';
import { StripeModule } from './stripe/stripe.module';
import { VotingCyclesModule } from './voting-cycles/voting-cycles.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PayoutsModule } from './payouts/payouts.module';
import { CharitiesModule } from './charities/charities.module';
import { ModeratorModule } from './moderator/moderator.module';
import { UploadModule } from './upload/upload.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/faithfighters',
    ),
    AuthModule,
    UsersModule,
    CausesModule,
    VideosModule,
    VotesModule,
    LeaderboardModule,
    DashboardModule,
    AdminModule,
    StripeModule,
    VotingCyclesModule,
    SubscriptionsModule,
    PayoutsModule,
    CharitiesModule,
    ModeratorModule,
    UploadModule,
    EmailModule,
  ],
})
export class AppModule {}
