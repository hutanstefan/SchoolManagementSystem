/** Whether the browser shows the file (preview) or saves it (download). */
export type Disposition = 'inline' | 'attachment';

export interface FileLinkOptions {
  disposition: Disposition;
  /** The name the browser saves the file under. */
  fileName: string;
  contentType: string;
}

export interface FileLink {
  url: string;
  expiresAt: Date;
}

/**
 * Where uploaded files live. Two implementations: a local folder (the default,
 * works out of the box) and any S3-compatible bucket (Cloudflare R2, AWS S3,
 * MinIO...). Files are private either way: they are only reachable through
 * short-lived signed links, given after the API has checked who is asking.
 */
export interface FileStorage {
  readonly driver: 'local' | 's3';
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Removes a file; a file that is already gone is not an error. */
  remove(key: string): Promise<void>;
  /** A link that works for `FILE_LINK_SECONDS`, without a login. */
  link(key: string, options: FileLinkOptions): Promise<FileLink>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

/** Keys look like "lectures/<uuid>.pdf": no "..", no absolute paths. */
export function assertSafeKey(key: string): void {
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*\.[a-z0-9]+$/.test(key)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}

/**
 * A Content-Disposition header that keeps non-ASCII names ("Lecție.pdf"):
 * an ASCII fallback plus the UTF-8 name (RFC 6266).
 */
export function contentDisposition(
  disposition: Disposition,
  fileName: string,
): string {
  const fallback =
    fileName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_') || 'file';
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
