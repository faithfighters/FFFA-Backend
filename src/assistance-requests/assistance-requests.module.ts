import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssistanceRequest, AssistanceRequestSchema } from './schemas/assistance-request.schema';
import { AssistanceRequestsService } from './assistance-requests.service';
import { AssistanceRequestsController } from './assistance-requests.controller';
import { UsersModule } from '../users/users.module';
import { Vote, VoteSchema } from '../votes/schemas/vote.schema';
import { Video, VideoSchema } from '../videos/schemas/video.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssistanceRequest.name, schema: AssistanceRequestSchema },
      // Registered directly (not via VotesModule/VideosModule) to avoid a module
      // cycle: VotesModule -> VideosModule -> AssistanceRequestsModule.
      { name: Vote.name, schema: VoteSchema },
      { name: Video.name, schema: VideoSchema },
    ]),
    UsersModule,
  ],
  controllers: [AssistanceRequestsController],
  providers: [AssistanceRequestsService],
  exports: [AssistanceRequestsService, MongooseModule],
})
export class AssistanceRequestsModule {}
