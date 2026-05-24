import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { VideosModule } from '../videos/videos.module';
import { VotingCyclesModule } from '../voting-cycles/voting-cycles.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CausesModule } from '../causes/causes.module';
import { CharitiesModule } from '../charities/charities.module';
import { VotesModule } from '../votes/votes.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { AdminSettings, AdminSettingsSchema } from './schemas/admin-settings.schema';
import { StripeModule } from '../stripe/stripe.module';
import { PaymentRecord, PaymentRecordSchema } from '../stripe/schemas/payment-record.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminSettings.name, schema: AdminSettingsSchema },
      { name: PaymentRecord.name, schema: PaymentRecordSchema },
    ]),
    UsersModule,
    VideosModule,
    VotingCyclesModule,
    PayoutsModule,
    SubscriptionsModule,
    CausesModule,
    CharitiesModule,
    VotesModule,
    TranscriptionModule,
    StripeModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
