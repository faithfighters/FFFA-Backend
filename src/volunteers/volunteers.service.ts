import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VolunteerApplication, VolunteerApplicationDocument } from './schemas/volunteer-application.schema';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectModel(VolunteerApplication.name) private model: Model<VolunteerApplicationDocument>,
  ) {}

  create(data: Partial<VolunteerApplication>): Promise<VolunteerApplicationDocument> {
    return this.model.create(data);
  }

  findAll(): Promise<VolunteerApplicationDocument[]> {
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  updateStatus(id: string, status: string): Promise<VolunteerApplicationDocument | null> {
    return this.model.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }
}
