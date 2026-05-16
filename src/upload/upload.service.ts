import { Injectable, BadRequestException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_VIDEO_SIZE_MB = 500;
const MAX_IMAGE_SIZE_MB = 10;
const PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cfUrl: string;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      // Disable automatic checksums so presigned PUT URLs work from browsers.
      // AWS SDK v3 defaults to WHEN_SUPPORTED which adds x-amz-checksum-crc32 to
      // presigned URLs; browsers can't compute/send that header, causing 400s.
      requestChecksumCalculation: 'WHEN_REQUIRED' as any,
      responseChecksumValidation: 'WHEN_REQUIRED' as any,
    });
    this.bucket = process.env.S3_BUCKET_NAME || 'fffa';
    this.cfUrl = (process.env.CLOUDFRONT_URL || '').replace(/\/$/, '');
  }

  /**
   * Generate a presigned PUT URL for direct browser → S3 upload.
   * Returns the presigned URL and the final public CloudFront URL.
   */
  async getPresignedUploadUrl(
    contentType: string,
    fileSizeBytes: number,
    folder: 'videos' | 'thumbnails',
  ): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
    const isVideo = folder === 'videos';
    const allowed = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
    const maxMb = isVideo ? MAX_VIDEO_SIZE_MB : MAX_IMAGE_SIZE_MB;

    if (!allowed.includes(contentType)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${allowed.join(', ')}`,
      );
    }

    if (fileSizeBytes > maxMb * 1024 * 1024) {
      throw new BadRequestException(
        `File too large. Maximum size is ${maxMb}MB.`,
      );
    }

    const ext = contentType.split('/')[1].replace('quicktime', 'mov');
    const key = `${folder}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    });

    const publicUrl = this.cfUrl
      ? `${this.cfUrl}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    return { uploadUrl, publicUrl, key };
  }

  /**
   * Delete a file from S3 by its key.
   * Called when a video submission is rejected or deleted.
   */
  async deleteFile(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** Extract the S3 key from a CloudFront or S3 URL */
  extractKey(url: string): string | null {
    if (!url || url === '#pending-upload') return null;
    if (this.cfUrl && url.startsWith(this.cfUrl)) {
      return url.slice(this.cfUrl.length + 1);
    }
    const s3Match = url.match(/amazonaws\.com\/(.+)$/);
    return s3Match?.[1] ?? null;
  }
}
