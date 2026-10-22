import { detectImageType } from './image-type';

describe('detectImageType', () => {
  const bytes = (...values: (number | string)[]) =>
    Buffer.concat(
      values.map((v) =>
        typeof v === 'string' ? Buffer.from(v, 'ascii') : Buffer.from([v]),
      ),
    );

  it('recognises the image formats the AI providers accept', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(
      detectImageType(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0x00)),
    ).toBe('image/png');
    expect(detectImageType(bytes('GIF89a', 0x01))).toBe('image/gif');
    expect(detectImageType(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe(
      'image/webp',
    );
  });

  it('rejects anything else, whatever the file is called', () => {
    expect(detectImageType(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(detectImageType(bytes(0, 0, 0, 0x18, 'ftypheic'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
