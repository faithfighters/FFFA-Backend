import { Module } from '@nestjs/common';
import { ModeratorController } from './moderator.controller';
import { VideosModule } from '../videos/videos.module';
import { CausesModule } from '../causes/causes.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [VideosModule, CausesModule, UsersModule, EmailModule],
  controllers: [ModeratorController],
})
export class ModeratorModule {}
