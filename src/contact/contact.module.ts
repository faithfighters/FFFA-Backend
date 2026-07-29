import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactMessage, ContactMessageSchema } from './schemas/contact-message.schema';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ContactMessage.name, schema: ContactMessageSchema }]),
  ],
  providers: [ContactService],
  controllers: [ContactController],
  exports: [ContactService],
})
export class ContactModule {}
