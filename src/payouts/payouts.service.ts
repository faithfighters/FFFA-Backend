import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payout, PayoutDocument } from './schemas/payout.schema';
import { PayoutBatch, PayoutBatchDocument } from './schemas/payout-batch.schema';

@Injectable()
export class PayoutsService {
  constructor(
    @InjectModel(Payout.name) private payoutModel: Model<PayoutDocument>,
    @InjectModel(PayoutBatch.name) private batchModel: Model<PayoutBatchDocument>,
  ) {}

  // ── Payouts ──────────────────────────────────────────────
  findAll(filter?: Record<string, any>): Promise<PayoutDocument[]> {
    return this.payoutModel.find(filter || {}).sort({ createdAt: -1 }).exec();
  }

  findById(id: string): Promise<PayoutDocument | null> {
    return this.payoutModel.findById(id).exec();
  }

  findByBatch(batchId: string): Promise<PayoutDocument[]> {
    return this.payoutModel.find({ batchId: new Types.ObjectId(batchId) }).exec();
  }

  async create(data: Partial<Payout>): Promise<PayoutDocument> {
    // Auto-generate receipt number
    const count = await this.payoutModel.countDocuments();
    const receiptNumber = `FFFA-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    return this.payoutModel.create({ ...data, receiptNumber });
  }

  update(id: string, updates: Partial<Payout>): Promise<PayoutDocument | null> {
    return this.payoutModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  // ── Batches ───────────────────────────────────────────────
  findAllBatches(): Promise<PayoutBatchDocument[]> {
    return this.batchModel.find().sort({ createdAt: -1 }).exec();
  }

  findBatchById(id: string): Promise<PayoutBatchDocument | null> {
    return this.batchModel.findById(id).exec();
  }

  createBatch(data: Partial<PayoutBatch>): Promise<PayoutBatchDocument> {
    return this.batchModel.create(data);
  }

  updateBatch(id: string, updates: Partial<PayoutBatch>): Promise<PayoutBatchDocument | null> {
    return this.batchModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  async processBatch(batchId: string, processedBy: string): Promise<{ batch: PayoutBatchDocument; payouts: PayoutDocument[] }> {
    const payouts = await this.findByBatch(batchId);
    const processed: PayoutDocument[] = [];

    for (const p of payouts) {
      if (p.status === 'pending' || p.status === 'processing') {
        const updated = await this.update(p._id.toString(), {
          status: 'paid',
          processedAt: new Date().toISOString(),
          processedBy,
        });
        if (updated) processed.push(updated);
      }
    }

    const totalProcessed = processed.reduce((s, p) => s + p.amount, 0);
    const batch = await this.updateBatch(batchId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      processedAmount: totalProcessed,
    });

    return { batch: batch!, payouts: processed };
  }
}
