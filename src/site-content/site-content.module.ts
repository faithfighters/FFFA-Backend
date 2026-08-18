import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SiteContent, SiteContentSchema } from './schemas/site-content.schema';
import { SiteContentService } from './site-content.service';
import { SiteContentController } from './site-content.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SiteContent.name, schema: SiteContentSchema }]),
  ],
  providers: [SiteContentService],
  controllers: [SiteContentController],
  exports: [SiteContentService],
})
export class SiteContentModule {}
