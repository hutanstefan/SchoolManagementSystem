import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { createStorage } from './create-storage';
import { FilesController } from './files.controller';
import { FILE_STORAGE } from './storage';

/** The file storage (local folder or S3 bucket), chosen by STORAGE_DRIVER. */
@Global()
@Module({
  controllers: [FilesController],
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createStorage({
          STORAGE_DRIVER: config.get('STORAGE_DRIVER', { infer: true }),
          STORAGE_DIR: config.get('STORAGE_DIR', { infer: true }),
          S3_ENDPOINT: config.get('S3_ENDPOINT', { infer: true }),
          S3_REGION: config.get('S3_REGION', { infer: true }),
          S3_BUCKET: config.get('S3_BUCKET', { infer: true }),
          S3_ACCESS_KEY_ID: config.get('S3_ACCESS_KEY_ID', { infer: true }),
          S3_SECRET_ACCESS_KEY: config.get('S3_SECRET_ACCESS_KEY', {
            infer: true,
          }),
          S3_FORCE_PATH_STYLE: config.get('S3_FORCE_PATH_STYLE', {
            infer: true,
          }),
          FILE_LINK_SECONDS: config.get('FILE_LINK_SECONDS', { infer: true }),
          JWT_SECRET: config.get('JWT_SECRET', { infer: true }),
        }),
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
