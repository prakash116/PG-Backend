/** Stores uploaded images in Cloudinary, or on local disk when it is not configured. */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The shape multer hands us from `memoryStorage()`. Declared locally because
 * multer ships no types, matching how this codebase already handles bcrypt and
 * cookie-parser.
 */
export interface UploadedImageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface CloudinaryUploadResult {
  secure_url?: string;
  url?: string;
}

interface CloudinaryWriteStream {
  end(buffer: Buffer): void;
}

interface CloudinaryApi {
  config(options: {
    cloud_name: string;
    api_key: string;
    api_secret: string;
    secure: boolean;
  }): unknown;
  uploader: {
    upload_stream(
      options: { folder: string; resource_type: 'image' },
      callback: (
        error: Error | undefined,
        result: CloudinaryUploadResult | undefined,
      ) => void,
    ): CloudinaryWriteStream;
  };
}

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Public path prefix; `main.ts` serves the same folder under this route. */
export const UPLOADS_ROUTE_PREFIX = '/uploads';
export const UPLOADS_DIRECTORY = 'uploads';
const PROFILE_FOLDER = 'profile';
const CLOUDINARY_FOLDER = `pzee/${PROFILE_FOLDER}`;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly cloudinary: CloudinaryApi | null;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.publicUrl = this.configService.getOrThrow<string>('app.publicUrl');
    this.cloudinary = this.createCloudinaryClient();

    this.logger.log(
      this.cloudinary
        ? 'Profile images are stored in Cloudinary.'
        : 'Profile images are stored on local disk. Set CLOUDINARY_* to use Cloudinary.',
    );
  }

  /** Returns an absolute URL that the browser can render directly. */
  async saveProfileImage(file: UploadedImageFile): Promise<string> {
    if (this.cloudinary) {
      return this.uploadToCloudinary(file);
    }

    return this.writeToDisk(file);
  }

  /**
   * Streams multer's in-memory buffer straight to Cloudinary. Streaming avoids
   * the ~33% inflation of encoding the image as a base64 data URI first.
   */
  private uploadToCloudinary(file: UploadedImageFile): Promise<string> {
    const cloudinary = this.cloudinary as CloudinaryApi;

    return new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: CLOUDINARY_FOLDER, resource_type: 'image' },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          const url = result?.secure_url ?? result?.url;

          if (!url) {
            reject(new Error('Cloudinary did not return an image URL.'));
            return;
          }

          resolve(url);
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  private async writeToDisk(file: UploadedImageFile): Promise<string> {
    const extension = EXTENSION_BY_MIME_TYPE[file.mimetype] ?? 'bin';
    const fileName = `${randomUUID()}.${extension}`;
    const directory = join(process.cwd(), UPLOADS_DIRECTORY, PROFILE_FOLDER);

    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, fileName), file.buffer);

    return `${this.publicUrl}${UPLOADS_ROUTE_PREFIX}/${PROFILE_FOLDER}/${fileName}`;
  }

  /** Cloudinary is optional: without all three values we fall back to disk. */
  private createCloudinaryClient(): CloudinaryApi | null {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName?.trim() || !apiKey?.trim() || !apiSecret?.trim()) {
      return null;
    }

    const { v2 } = require('cloudinary') as { v2: CloudinaryApi };

    v2.config({
      cloud_name: cloudName.trim(),
      api_key: apiKey.trim(),
      api_secret: apiSecret.trim(),
      // Always hand back https URLs, which the site can embed on any page.
      secure: true,
    });

    return v2;
  }
}
