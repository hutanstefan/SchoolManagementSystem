import { isAbsolute, resolve } from 'node:path';
import { LocalFileStorage } from './local-storage';
import { S3FileStorage } from './s3-storage';
import type { FileStorage } from './storage';

/** The settings the storage needs (a subset of the API's environment). */
export interface StorageSettings {
  STORAGE_DRIVER: 'local' | 's3';
  STORAGE_DIR: string;
  S3_ENDPOINT?: string;
  S3_REGION: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_FORCE_PATH_STYLE: boolean;
  FILE_LINK_SECONDS: number;
  JWT_SECRET: string;
}

/**
 * The backend folder (this file is in src/storage, or dist/storage once
 * built). A relative STORAGE_DIR is inside it, wherever the API or the seed
 * is started from, so both always use the same folder.
 */
export const BACKEND_ROOT = resolve(__dirname, '..', '..');

/** Where the local driver keeps files: STORAGE_DIR, relative to the backend folder. */
export function storageRoot(directory: string): string {
  return isAbsolute(directory) ? directory : resolve(BACKEND_ROOT, directory);
}

/** Used by the API and by the seed, so both put files in the same place. */
export function createStorage(settings: StorageSettings): FileStorage {
  if (settings.STORAGE_DRIVER === 's3') {
    return new S3FileStorage({
      endpoint: settings.S3_ENDPOINT!,
      region: settings.S3_REGION,
      bucket: settings.S3_BUCKET!,
      accessKeyId: settings.S3_ACCESS_KEY_ID!,
      secretAccessKey: settings.S3_SECRET_ACCESS_KEY!,
      forcePathStyle: settings.S3_FORCE_PATH_STYLE,
      linkSeconds: settings.FILE_LINK_SECONDS,
    });
  }
  return new LocalFileStorage(
    storageRoot(settings.STORAGE_DIR),
    settings.JWT_SECRET,
    settings.FILE_LINK_SECONDS,
  );
}
