import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StripeController } from './stripe.controller';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentRecord, PaymentRecordSchema } from './schemas/payment-record.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PaymentRecord.name, schema: PaymentRecordSchema }]),
    UsersModule,
    SubscriptionsModule,
    NotificationsModule,
  ],
  controllers: [StripeController],
  exports: [MongooseModule],
})
export class StripeModule {}
