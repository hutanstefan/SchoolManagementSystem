import type { ImageMediaType } from './readers/test-reader';

/**
 * The real type of an uploaded image, from its first bytes ("magic numbers").
 * The file name and the Content-Type sent by the browser are not trusted.
 */
export function detectImageType(data: Buffer): ImageMediaType | null {
  const startsWith = (bytes: number[], offset = 0) =>
    data.length >= offset + bytes.length &&
    bytes.every((byte, i) => data[offset + i] === byte);
  const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(ascii('GIF87a')) || startsWith(ascii('GIF89a'))) {
    return 'image/gif';
  }
  if (startsWith(ascii('RIFF')) && startsWith(ascii('WEBP'), 8)) {
    return 'image/webp';
  }
  return null;
}
