import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  assertSafeKey,
  contentDisposition,
  type FileLink,
  type FileLinkOptions,
  type FileStorage,
} from './storage';

export interface S3Settings {
  /** e.g. https://<account id>.r2.cloudflarestorage.com */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  linkSeconds: number;
  /** Bucket in the path, not the host name (MinIO, local test servers). */
  forcePathStyle?: boolean;
}

/**
 * Files in an S3-compatible bucket (Cloudflare R2 has a free tier). The
 * bucket stays private: links are pre-signed GET URLs that expire, and they
 * tell the bucket how the browser should treat the file (preview or save).
 */
export class S3FileStorage implements FileStorage {
  readonly driver = 's3' as const;
  private readonly client: S3Client;

  constructor(private readonly settings: S3Settings) {
    this.client = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region,
      forcePathStyle: settings.forcePathStyle ?? false,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
      },
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async remove(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }),
    );
  }

  async link(key: string, options: FileLinkOptions): Promise<FileLink> {
    assertSafeKey(key);
    const expiresIn = this.settings.linkSeconds;
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        ResponseContentType: options.contentType,
        ResponseContentDisposition: contentDisposition(
          options.disposition,
          options.fileName,
        ),
      }),
      { expiresIn },
    );
    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }
}
