import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CharityDocument = Charity & Document;

const toJSON = {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

@Schema({ timestamps: true, toJSON })
export class Charity {
  @Prop({ required: true })
  name: string;

  @Prop()
  ein: string; // Employer Identification Number / Tax ID

  @Prop()
  description: string;

  @Prop()
  contactName: string;

  @Prop()
  contactEmail: string;

  @Prop()
  contactPhone: string;

  @Prop()
  address: string;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: string;

  // Payment methods stored as sub-documents
  @Prop({
    type: {
      ach: {
        routingNumber: String,
        accountNumber: String,
        bankName: String,
        accountType: { type: String, enum: ['checking', 'savings'] },
      },
      check: {
        payableTo: String,
        mailingAddress: String,
      },
      paypal: {
        email: String,
      },
    },
    default: {},
  })
  paymentMethods: {
    ach?: { routingNumber?: string; accountNumber?: string; bankName?: string; accountType?: string };
    check?: { payableTo?: string; mailingAddress?: string };
    paypal?: { email?: string };
  };

  @Prop({ type: [String], default: [] })
  causeIds: string[]; // causes this charity supports
}

export const CharitySchema = SchemaFactory.createForClass(Charity);
