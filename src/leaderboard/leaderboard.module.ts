import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { CausesModule } from '../causes/causes.module';

@Module({
  imports: [CausesModule],
  controllers: [LeaderboardController],
})
export class LeaderboardModule {}
