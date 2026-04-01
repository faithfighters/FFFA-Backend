import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vote, VoteSchema } from './schemas/vote.schema';
import { VotesService } from './votes.service';
import { VotesController } from './votes.controller';
import { VotingCyclesModule } from '../voting-cycles/voting-cycles.module';
import { CausesModule } from '../causes/causes.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Vote.name, schema: VoteSchema }]),
    VotingCyclesModule,
    CausesModule,
    UsersModule,
  ],
  providers: [VotesService],
  controllers: [VotesController],
  exports: [VotesService, MongooseModule],
})
export class VotesModule {}
