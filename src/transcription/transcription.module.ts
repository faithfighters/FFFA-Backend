import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TranscriptionService } from './transcription.service';
import { Video, VideoSchema } from '../videos/schemas/video.schema';
import { AdminSettings, AdminSettingsSchema } from '../admin/schemas/admin-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Video.name, schema: VideoSchema },
      { name: AdminSettings.name, schema: AdminSettingsSchema },
    ]),
  ],
  providers: [TranscriptionService],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
