import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { StripeController } from './stripe.controller';
import { StripeSyncService } from './stripe-sync.service';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentRecord, PaymentRecordSchema } from './schemas/payment-record.schema';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: PaymentRecord.name, schema: PaymentRecordSchema }]),
    UsersModule,
    SubscriptionsModule,
    NotificationsModule,
  ],
  controllers: [StripeController],
  providers: [StripeSyncService],
  exports: [MongooseModule, StripeSyncService],
})
export class StripeModule {}
