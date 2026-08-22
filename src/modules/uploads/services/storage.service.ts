/** Stores uploaded images in Cloudinary, or on local disk when it is not configured. */
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
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
    destroy(
      publicId: string,
      options: { resource_type: 'image'; invalidate: boolean },
    ): Promise<{ result?: string }>;
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
/** Folders images may be filed under. Kept closed so a caller cannot write anywhere. */
export type UploadFolder = 'profile' | 'pg' | 'room' | 'logo';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly cloudinary: CloudinaryApi | null;
  private readonly publicUrl: string;
  /** Used to confirm a URL belongs to our Cloudinary account before deleting. */
  private readonly cloudName: string;

  constructor(private readonly configService: ConfigService) {
    this.publicUrl = this.configService.getOrThrow<string>('app.publicUrl');
    this.cloudName =
      this.configService.get<string>('CLOUDINARY_CLOUD_NAME')?.trim() ?? '';
    this.cloudinary = this.createCloudinaryClient();

    this.logger.log(
      this.cloudinary
        ? 'Uploaded images are stored in Cloudinary.'
        : 'Uploaded images are stored on local disk. Set CLOUDINARY_* to use Cloudinary.',
    );
  }

  /** Returns an absolute URL that the browser can render directly. */
  async saveImage(
    file: UploadedImageFile,
    folder: UploadFolder,
  ): Promise<string> {
    if (this.cloudinary) {
      return this.uploadToCloudinary(file, folder);
    }

    return this.writeToDisk(file, folder);
  }

  /**
   * Streams multer's in-memory buffer straight to Cloudinary. Streaming avoids
   * the ~33% inflation of encoding the image as a base64 data URI first.
   */
  private uploadToCloudinary(
    file: UploadedImageFile,
    folder: UploadFolder,
  ): Promise<string> {
    const cloudinary = this.cloudinary as CloudinaryApi;

    return new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `pzee/${folder}`, resource_type: 'image' },
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

  /**
   * Removes an image this API stored. Deliberately best-effort: a failed
   * cleanup is logged and swallowed, because losing an orphan file is a much
   * smaller problem than failing the owner's save.
   *
   * A URL this API did not produce — an external one, say — is ignored, so a
   * bad value can never reach into the Cloudinary account at large.
   */
  async deleteImage(url: string): Promise<void> {
    try {
      const publicId = this.cloudinaryPublicIdOf(url);

      if (publicId) {
        await (this.cloudinary as CloudinaryApi).uploader.destroy(publicId, {
          resource_type: 'image',
          invalidate: true,
        });
        return;
      }

      const diskPath = this.diskPathOf(url);

      if (diskPath) {
        await rm(diskPath, { force: true });
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Could not delete image ${url}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  /** Deletes many images without letting one failure stop the rest. */
  async deleteImages(urls: string[]): Promise<void> {
    await Promise.all(urls.map((url) => this.deleteImage(url)));
  }

  /**
   * Pulls the Cloudinary public id out of one of our own URLs, e.g.
   * `https://res.cloudinary.com/<cloud>/image/upload/v1712/pzee/room/a.png`
   * becomes `pzee/room/a`. Returns null for anything else.
   */
  private cloudinaryPublicIdOf(url: string): string | null {
    if (!this.cloudinary || !this.cloudName) {
      return null;
    }

    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    if (parsed.hostname !== 'res.cloudinary.com') {
      return null;
    }

    const segments = parsed.pathname.split('/').filter(Boolean);

    // Only ever touch assets in our own cloud.
    if (segments[0] !== this.cloudName) {
      return null;
    }

    const uploadIndex = segments.indexOf('upload');

    if (uploadIndex === -1) {
      return null;
    }

    let rest = segments.slice(uploadIndex + 1);

    // A version prefix sits between `upload` and the public id.
    if (rest[0] && /^v\d+$/.test(rest[0])) {
      rest = rest.slice(1);
    }

    if (rest.length === 0) {
      return null;
    }

    const fileName = rest[rest.length - 1].replace(/\.[^.]+$/, '');

    return [...rest.slice(0, -1), fileName].join('/');
  }

  /** Resolves one of our own local-disk URLs to a path inside the uploads folder. */
  private diskPathOf(url: string): string | null {
    const prefix = `${this.publicUrl}${UPLOADS_ROUTE_PREFIX}/`;

    if (!url.startsWith(prefix)) {
      return null;
    }

    const [folder, fileName] = url.slice(prefix.length).split('/');

    if (!folder || !fileName) {
      return null;
    }

    const root = resolve(process.cwd(), UPLOADS_DIRECTORY);
    const candidate = resolve(root, basename(folder), basename(fileName));

    // `basename` alone is not enough: it leaves '..' intact, so a crafted URL
    // could still climb out. Resolve first, then confirm containment.
    if (!candidate.startsWith(root + sep)) {
      return null;
    }

    return candidate;
  }

  private async writeToDisk(
    file: UploadedImageFile,
    folder: UploadFolder,
  ): Promise<string> {
    const extension = EXTENSION_BY_MIME_TYPE[file.mimetype] ?? 'bin';
    const fileName = `${randomUUID()}.${extension}`;
    const directory = join(process.cwd(), UPLOADS_DIRECTORY, folder);

    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, fileName), file.buffer);

    return `${this.publicUrl}${UPLOADS_ROUTE_PREFIX}/${folder}/${fileName}`;
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
