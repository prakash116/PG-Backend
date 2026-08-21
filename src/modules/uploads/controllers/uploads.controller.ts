import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UploadImageResponse } from '../models/upload-response.model';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  StorageService,
  UploadedImageFile,
} from '../services/storage.service';

/** multer ships no types, so its factory is required the way bcrypt is. */
const { memoryStorage } = require('multer') as {
  memoryStorage: () => unknown;
};

type MulterFileFilterCallback = (
  error: Error | null,
  acceptFile: boolean,
) => void;

/**
 * Rejects non-images while the request is still streaming, so an unwanted file
 * is never buffered in full. The thrown HttpException passes through Nest's
 * multer error mapping untouched and surfaces as a 400.
 */
function imageFileFilter(
  _request: unknown,
  file: { mimetype: string },
  callback: MulterFileFilterCallback,
): void {
  const isAllowed = ALLOWED_IMAGE_MIME_TYPES.includes(
    file.mimetype as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
  );

  if (!isAllowed) {
    callback(
      new BadRequestException('Only JPEG, PNG and WebP images are allowed.'),
      false,
    );
    return;
  }

  callback(null, true);
}

@ApiTags('Uploads')
@Controller()
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(private readonly storageService: StorageService) {}

  @Post('profile-image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      // Kept in memory so the buffer can be streamed straight to Cloudinary
      // without ever touching this server's disk.
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
      fileFilter: imageFileFilter,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload a profile photo',
    description:
      'Returns a URL to send as `profileImage` when registering. Accepts JPEG, PNG or WebP up to 5 MB.',
  })
  @ApiOkResponse({
    description: 'Image uploaded successfully.',
    type: UploadImageResponse,
  })
  @ApiBadRequestResponse({ description: 'Missing file, or not a JPEG/PNG/WebP.' })
  @ApiPayloadTooLargeResponse({ description: 'File is larger than 5 MB.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async uploadProfileImage(
    @UploadedFile() file?: UploadedImageFile,
  ): Promise<UploadImageResponse> {
    if (!file) {
      throw new BadRequestException('Please choose an image to upload.');
    }

    try {
      const url = await this.storageService.saveProfileImage(file);

      return {
        success: true,
        message: 'Image uploaded successfully.',
        data: { url },
      };
    } catch (error: unknown) {
      // The reason belongs in the logs, not in the HTTP response.
      this.logger.error('Profile image upload failed.', error);
      throw new InternalServerErrorException('Internal Server Error.');
    }
  }
}
