import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Upload')
@ApiCookieAuth('fffa_session')
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /upload/presign
   * Returns a presigned S3 PUT URL + final public URL.
   * The client uploads directly to S3 using the presigned URL,
   * then submits the public URL in the video/thumbnail form field.
   */
  @ApiOperation({
    summary: 'Get a presigned S3 upload URL',
    description:
      'Step 1: Call this endpoint to get a presigned PUT URL.\n' +
      'Step 2: PUT the file directly to the presigned URL from the browser.\n' +
      'Step 3: Submit the returned `publicUrl` as the videoUrl or thumbnailUrl.',
  })
  @ApiBody({
    schema: {
      properties: {
        contentType: {
          type: 'string',
          example: 'video/mp4',
          description: 'MIME type of the file',
        },
        fileSizeBytes: {
          type: 'number',
          example: 52428800,
          description: 'File size in bytes (max 500MB for video, 10MB for images)',
        },
        folder: {
          type: 'string',
          enum: ['videos', 'thumbnails'],
          description: 'Destination folder in S3',
        },
      },
      required: ['contentType', 'fileSizeBytes', 'folder'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL and final public URL',
    schema: {
      properties: {
        uploadUrl: { type: 'string', description: 'PUT this URL directly from the browser' },
        publicUrl: { type: 'string', description: 'Store this URL in the video record' },
        key: { type: 'string', description: 'S3 object key' },
        expiresInSeconds: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or file too large' })
  @Post('presign')
  async presign(
    @Body()
    body: {
      contentType: string;
      fileSizeBytes: number;
      folder: 'videos' | 'thumbnails' | 'images' | 'documents';
    },
  ) {
    const { contentType, fileSizeBytes, folder } = body;

    if (!contentType || !fileSizeBytes || !folder) {
      throw new BadRequestException('contentType, fileSizeBytes, and folder are required.');
    }

    if (!['videos', 'thumbnails', 'images', 'documents'].includes(folder)) {
      throw new BadRequestException('folder must be "videos", "thumbnails", "images", or "documents".');
    }

    const result = await this.uploadService.getPresignedUploadUrl(
      contentType,
      fileSizeBytes,
      folder,
    );

    return { ...result, expiresInSeconds: 300 };
  }
}
