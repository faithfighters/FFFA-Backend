import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cause, CauseSchema } from './schemas/cause.schema';
import { CausesService } from './causes.service';
import { CausesController } from './causes.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cause.name, schema: CauseSchema }]),
    UsersModule,
  ],
  providers: [CausesService],
  controllers: [CausesController],
  exports: [CausesService, MongooseModule],
})
export class CausesModule {}
