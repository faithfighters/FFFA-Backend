import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Video, VideoDocument } from '../videos/schemas/video.schema';
import { AdminSettings, AdminSettingsDocument } from '../admin/schemas/admin-settings.schema';

const ASSEMBLYAI_API = 'https://api.assemblyai.com/v2';
const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 72; // 6 minutes max

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly apiKey = process.env.ASSEMBLYAI_API_KEY || '';

  constructor(
    @InjectModel(Video.name) private readonly videoModel: Model<VideoDocument>,
    @InjectModel(AdminSettings.name) private readonly settingsModel: Model<AdminSettingsDocument>,
  ) {}

  /** Fire-and-forget: submit video for transcription and handle result asynchronously */
  triggerTranscription(videoId: string, videoUrl: string): void {
    if (!this.apiKey) {
      this.logger.warn('ASSEMBLYAI_API_KEY not set — transcription skipped.');
      return;
    }
    this.run(videoId, videoUrl).catch(err =>
      this.logger.error(`Transcription failed for video ${videoId}: ${err.message}`),
    );
  }

  private async run(videoId: string, videoUrl: string): Promise<void> {
    await this.videoModel.findByIdAndUpdate(videoId, { transcriptionStatus: 'pending' });

    // Submit job
    const submitRes = await fetch(`${ASSEMBLYAI_API}/transcript`, {
      method: 'POST',
      headers: { authorization: this.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ audio_url: videoUrl, speech_models: ['universal-2'] }),
    });
    if (!submitRes.ok) throw new Error(`AssemblyAI submit failed: ${submitRes.status}`);
    const { id: jobId } = await submitRes.json() as { id: string };

    await this.videoModel.findByIdAndUpdate(videoId, { transcriptionJobId: jobId });

    // Poll for completion
    let transcript = '';
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${ASSEMBLYAI_API}/transcript/${jobId}`, {
        headers: { authorization: this.apiKey },
      });
      const data = await pollRes.json() as { status: string; text?: string; error?: string };

      if (data.status === 'completed') {
        transcript = data.text || '';
        break;
      }
      if (data.status === 'error') {
        throw new Error(`AssemblyAI error: ${data.error}`);
      }
    }

    if (!transcript) {
      await this.videoModel.findByIdAndUpdate(videoId, { transcriptionStatus: 'failed' });
      return;
    }

    await this.videoModel.findByIdAndUpdate(videoId, {
      transcript,
      transcriptionStatus: 'done',
    });

    // Check against blocked words and auto-reject if any found
    const settings = await this.settingsModel.findOne({ key: 'global' });
    const blockedWords: string[] = settings?.blockedWords ?? [];
    if (blockedWords.length === 0) return;

    const lowerTranscript = transcript.toLowerCase();
    const matched = blockedWords.filter(w => lowerTranscript.includes(w.toLowerCase()));
    if (matched.length > 0) {
      this.logger.warn(`Video ${videoId} auto-rejected — blocked words: ${matched.join(', ')}`);
      await this.videoModel.findByIdAndUpdate(videoId, {
        status: 'rejected',
        rejectionReason: `Automatically rejected: content contains prohibited language.`,
        moderatedAt: new Date().toISOString(),
        moderatedByName: 'System',
      });
    }
  }

  async getBlockedWords(): Promise<string[]> {
    const s = await this.settingsModel.findOne({ key: 'global' });
    return s?.blockedWords ?? [];
  }

  async addBlockedWord(word: string): Promise<string[]> {
    const clean = word.trim().toLowerCase();
    const s = await this.settingsModel.findOneAndUpdate(
      { key: 'global' },
      { $addToSet: { blockedWords: clean } },
      { upsert: true, new: true },
    );
    return s!.blockedWords;
  }

  async removeBlockedWord(word: string): Promise<string[]> {
    const clean = word.trim().toLowerCase();
    const s = await this.settingsModel.findOneAndUpdate(
      { key: 'global' },
      { $pull: { blockedWords: clean } },
      { new: true },
    );
    return s?.blockedWords ?? [];
  }
}
