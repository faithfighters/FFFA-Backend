import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VotingCycle, VotingCycleSchema } from './schemas/voting-cycle.schema';
import { VotingCyclesService } from './voting-cycles.service';
import { VotingCyclesController } from './voting-cycles.controller';
import { CausesModule } from '../causes/causes.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: VotingCycle.name, schema: VotingCycleSchema }]),
    CausesModule,
  ],
  providers: [VotingCyclesService],
  controllers: [VotingCyclesController],
  exports: [VotingCyclesService, MongooseModule],
})
export class VotingCyclesModule {}

