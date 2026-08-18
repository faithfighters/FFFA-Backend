import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SiteContent, SiteContentDocument } from './schemas/site-content.schema';
import { PAGE_MANIFESTS } from './manifests';
import { PageManifest } from './manifests/types';

@Injectable()
export class SiteContentService {
  constructor(
    @InjectModel(SiteContent.name) private model: Model<SiteContentDocument>,
  ) {}

  /** Every page an admin can edit, with whether it's been saved before. */
  async listPages(): Promise<{ page: string; label: string; updatedAt?: string; updatedBy?: string }[]> {
    const docs = await this.model.find().exec();
    const savedByPage = new Map(docs.map(d => [d.page, d]));
    return Object.values(PAGE_MANIFESTS).map(m => {
      const doc = savedByPage.get(m.page);
      return {
        page: m.page,
        label: m.label,
        updatedAt: (doc as any)?.updatedAt,
        updatedBy: doc?.updatedBy,
      };
    });
  }

  getManifest(page: string): PageManifest {
    const manifest = PAGE_MANIFESTS[page];
    if (!manifest) throw new NotFoundException(`No content manifest registered for page "${page}".`);
    return manifest;
  }

  async getContent(page: string): Promise<Record<string, any>> {
    const doc = await this.model.findOne({ page }).exec();
    return doc?.content ?? {};
  }

  async replaceContent(page: string, content: Record<string, any>, updatedBy: string): Promise<SiteContentDocument> {
    // Manifest existence check first — never let an admin save content for a
    // page that isn't a real, registered page (typos in the URL, etc).
    this.getManifest(page);
    return this.model.findOneAndUpdate(
      { page },
      { page, content, updatedBy },
      { new: true, upsert: true },
    ).exec();
  }
}
