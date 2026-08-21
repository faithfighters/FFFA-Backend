import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Video, VideoDocument } from './schemas/video.schema';

@Injectable()
export class VideosService {
  constructor(@InjectModel(Video.name) private videoModel: Model<VideoDocument>) {}

  findAll(filter?: Record<string, any>): Promise<VideoDocument[]> {
    return this.videoModel.find(filter || {}).sort({ createdAt: -1 }).exec();
  }

  findById(id: string): Promise<VideoDocument | null> {
    return this.videoModel.findById(id).exec();
  }

  create(data: Partial<Video>): Promise<VideoDocument> {
    return this.videoModel.create(data);
  }

  update(id: string, updates: Partial<Video>): Promise<VideoDocument | null> {
    return this.videoModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  remove(id: string): Promise<VideoDocument | null> {
    return this.videoModel.findByIdAndDelete(id).exec();
  }
}
