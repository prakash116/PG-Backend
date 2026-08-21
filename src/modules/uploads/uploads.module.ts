/** Uploads module: accepts profile photos and returns their public URL. */
import { Module } from '@nestjs/common';
import { UploadsController } from './controllers/uploads.controller';
import { StorageService } from './services/storage.service';

@Module({
  controllers: [UploadsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class UploadsModule {}
