import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payout, PayoutSchema } from './schemas/payout.schema';
import { PayoutBatch, PayoutBatchSchema } from './schemas/payout-batch.schema';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payout.name, schema: PayoutSchema },
      { name: PayoutBatch.name, schema: PayoutBatchSchema },
    ]),
  ],
  providers: [PayoutsService],
  exports: [PayoutsService, MongooseModule],
})
export class PayoutsModule {}
