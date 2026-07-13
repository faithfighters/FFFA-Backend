import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vote, VoteSchema } from './schemas/vote.schema';
import { VotesService } from './votes.service';
import { VotesController } from './votes.controller';
import { VotingCyclesModule } from '../voting-cycles/voting-cycles.module';
import { CausesModule } from '../causes/causes.module';
import { UsersModule } from '../users/users.module';
import { VideosModule } from '../videos/videos.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Vote.name, schema: VoteSchema }]),
    VotingCyclesModule,
    CausesModule,
    UsersModule,
    VideosModule,
    NotificationsModule,
  ],
  providers: [VotesService],
  controllers: [VotesController],
  exports: [VotesService, MongooseModule],
})
export class VotesModule {}
