import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Video, VideoSchema } from './schemas/video.schema';
import { VideosService } from './videos.service';
import { VideosController } from './videos.controller';
import { UsersModule } from '../users/users.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { CausesModule } from '../causes/causes.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    UsersModule,
    TranscriptionModule,
    CausesModule,
  ],
  providers: [VideosService],
  controllers: [VideosController],
  exports: [VideosService, MongooseModule],
})
export class VideosModule {}
