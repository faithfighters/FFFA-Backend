import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { NotificationsModule } from './notifications/notifications.module';
import { EventsModule } from './events/events.module';
import { AssistanceRequestsModule } from './assistance-requests/assistance-requests.module';
import { VolunteersModule } from './volunteers/volunteers.module';
import { ContactModule } from './contact/contact.module';
import { SiteContentModule } from './site-content/site-content.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global rate limiter — default: 100 req / 60s per IP
    // Individual endpoints override this with @Throttle()
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
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
    NotificationsModule,
    EventsModule,
    AssistanceRequestsModule,
    VolunteersModule,
    ContactModule,
    SiteContentModule,
  ],
  providers: [
    // Apply ThrottlerGuard globally — use @SkipThrottle() to opt out per route
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
