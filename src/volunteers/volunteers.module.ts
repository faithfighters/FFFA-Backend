import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VolunteerApplication, VolunteerApplicationSchema } from './schemas/volunteer-application.schema';
import { VolunteersService } from './volunteers.service';
import { VolunteersController } from './volunteers.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: VolunteerApplication.name, schema: VolunteerApplicationSchema }]),
  ],
  providers: [VolunteersService],
  controllers: [VolunteersController],
  exports: [VolunteersService],
})
export class VolunteersModule {}
