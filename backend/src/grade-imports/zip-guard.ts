import { inflateRawSync } from 'node:zlib';

/** An .xlsx is a zip: the template unpacks to well under 1 MB. */
export const MAX_UNPACKED_BYTES = 25 * 1024 * 1024;
const MAX_ENTRIES = 1000;

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;

export class UnsafeZipError extends Error {}

/**
 * Checks that a zip file (an uploaded .xlsx) doesn't unpack to more than
 * `maxBytes`, before a spreadsheet library unpacks it in memory. A small
 * "zip bomb" could otherwise unpack to gigabytes and crash the API.
 *
 * Every entry is really decompressed, with zlib stopping at the remaining
 * budget, so sizes written in the file (which can lie) are not trusted.
 */
export function assertSafeZip(
  zip: Buffer,
  maxBytes = MAX_UNPACKED_BYTES,
): void {
  const end = findEndOfCentralDirectory(zip);
  const entries = zip.readUInt16LE(end + 10);
  if (entries > MAX_ENTRIES) {
    throw new UnsafeZipError(`The file has too many parts (${entries})`);
  }

  let offset = zip.readUInt32LE(end + 16);
  let unpacked = 0;
  for (let i = 0; i < entries; i++) {
    if (
      offset + 46 > zip.length ||
      zip.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY
    ) {
      throw new UnsafeZipError('The file is damaged');
    }
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeader = zip.readUInt32LE(offset + 42);

    if (
      localHeader + 30 > zip.length ||
      zip.readUInt32LE(localHeader) !== LOCAL_FILE_HEADER
    ) {
      throw new UnsafeZipError('The file is damaged');
    }
    const dataStart =
      localHeader +
      30 +
      zip.readUInt16LE(localHeader + 26) +
      zip.readUInt16LE(localHeader + 28);
    const data = zip.subarray(dataStart, dataStart + compressedSize);
    const budget = maxBytes - unpacked;

    if (method === STORED) {
      unpacked += data.length;
    } else if (method === DEFLATED) {
      try {
        unpacked += inflateRawSync(data, {
          maxOutputLength: budget + 1,
        }).length;
      } catch (error) {
        if ((error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
          unpacked = maxBytes + 1;
        } else {
          throw new UnsafeZipError('The file is damaged');
        }
      }
    } else {
      throw new UnsafeZipError('The file uses an unsupported compression');
    }
    if (unpacked > maxBytes) {
      throw new UnsafeZipError('The file is too large once unpacked');
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }
}

/** The end-of-central-directory record is in the last 64 KB of the file. */
function findEndOfCentralDirectory(zip: Buffer): number {
  const stop = Math.max(0, zip.length - 22 - 0xffff);
  for (let i = zip.length - 22; i >= stop; i--) {
    if (zip.readUInt32LE(i) === END_OF_CENTRAL_DIRECTORY) return i;
  }
  throw new UnsafeZipError('Not a zip file');
}
