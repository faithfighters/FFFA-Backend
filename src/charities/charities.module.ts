import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Charity, CharitySchema } from './schemas/charity.schema';
import { CharitiesService } from './charities.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Charity.name, schema: CharitySchema }])],
  providers: [CharitiesService],
  exports: [CharitiesService, MongooseModule],
})
export class CharitiesModule {}
