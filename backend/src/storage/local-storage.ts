import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  assertSafeKey,
  type Disposition,
  type FileLink,
  type FileLinkOptions,
  type FileStorage,
} from './storage';

interface LinkPayload {
  /** key */
  k: string;
  /** disposition: i(nline) or a(ttachment) */
  d: 'i' | 'a';
  /** file name */
  n: string;
  /** content type */
  t: string;
  /** expires, Unix seconds */
  e: number;
}

/** Why a link didn't open a file. */
export type OpenFailure = 'invalid' | 'expired' | 'missing';

export interface OpenedFile {
  stream: ReadStream;
  size: number;
  contentType: string;
  disposition: Disposition;
  fileName: string;
}

const base64url = (data: Buffer | string) =>
  Buffer.from(data).toString('base64url');

/**
 * Files in a folder on the API's disk. Links point to GET /api/files/:token,
 * where the token names the file and expires: it is signed with a key
 * derived from JWT_SECRET, so it can't be forged or extended.
 */
export class LocalFileStorage implements FileStorage {
  readonly driver = 'local' as const;
  /** The folder, as an absolute path. */
  readonly root: string;
  private readonly signingKey: Buffer;

  constructor(
    directory: string,
    secret: string,
    private readonly linkSeconds: number,
    private readonly publicPath = '/api/files',
  ) {
    this.root = resolve(directory);
    this.signingKey = createHmac('sha256', secret)
      .update('file-links')
      .digest();
  }

  private path(key: string): string {
    assertSafeKey(key);
    return join(this.root, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  link(key: string, options: FileLinkOptions): Promise<FileLink> {
    try {
      return Promise.resolve(this.signedLink(key, options));
    } catch (error) {
      // A bad key rejects, like the S3 driver, instead of throwing.
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private signedLink(key: string, options: FileLinkOptions): FileLink {
    assertSafeKey(key);
    const expiresAt = new Date(Date.now() + this.linkSeconds * 1000);
    const payload: LinkPayload = {
      k: key,
      d: options.disposition === 'inline' ? 'i' : 'a',
      n: options.fileName,
      t: options.contentType,
      e: Math.floor(expiresAt.getTime() / 1000),
    };
    const body = base64url(JSON.stringify(payload));
    return {
      url: `${this.publicPath}/${body}.${this.sign(body)}`,
      expiresAt,
    };
  }

  /**
   * The file a token points to, or why there is none: a token that isn't
   * ours ("invalid"), one past its time ("expired"), or a file that is not in
   * the folder ("missing", e.g. the API looks in another folder than the one
   * the files were put in).
   */
  async open(token: string): Promise<OpenedFile | OpenFailure> {
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra !== undefined) return 'invalid';
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given))
      return 'invalid';

    let payload: LinkPayload;
    try {
      payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as LinkPayload;
    } catch {
      return 'invalid';
    }
    if (typeof payload.e !== 'number') return 'invalid';
    if (payload.e * 1000 < Date.now()) return 'expired';

    const path = this.path(payload.k);
    try {
      const info = await stat(path);
      return {
        stream: createReadStream(path),
        size: info.size,
        contentType: payload.t,
        disposition: payload.d === 'i' ? 'inline' : 'attachment',
        fileName: payload.n,
      };
    } catch {
      return 'missing';
    }
  }

  private sign(body: string): string {
    return createHmac('sha256', this.signingKey)
      .update(body)
      .digest('base64url');
  }
}
