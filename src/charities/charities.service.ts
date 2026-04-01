import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Charity, CharityDocument } from './schemas/charity.schema';

@Injectable()
export class CharitiesService {
  constructor(@InjectModel(Charity.name) private charityModel: Model<CharityDocument>) {}

  findAll(): Promise<CharityDocument[]> {
    return this.charityModel.find().exec();
  }

  findActive(): Promise<CharityDocument[]> {
    return this.charityModel.find({ status: 'active' }).exec();
  }

  findById(id: string): Promise<CharityDocument | null> {
    return this.charityModel.findById(id).exec();
  }

  create(data: Partial<Charity>): Promise<CharityDocument> {
    return this.charityModel.create(data);
  }

  update(id: string, updates: Partial<Charity>): Promise<CharityDocument | null> {
    return this.charityModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  delete(id: string): Promise<CharityDocument | null> {
    return this.charityModel.findByIdAndDelete(id).exec();
  }
}
