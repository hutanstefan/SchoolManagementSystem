import { cleanFileName, isPdf } from './pdf';

describe('isPdf', () => {
  it('looks at the bytes, not the name', () => {
    expect(isPdf(Buffer.from('%PDF-1.7\n...'))).toBe(true);
    // Some writers put a few bytes before the header.
    expect(isPdf(Buffer.from('\n\n%PDF-1.4'))).toBe(true);
    expect(isPdf(Buffer.from('MZ\x90\x00'))).toBe(false);
    expect(
      isPdf(Buffer.concat([Buffer.alloc(2000), Buffer.from('%PDF-')])),
    ).toBe(false);
  });
});

describe('cleanFileName', () => {
  it('repairs names that multer read as latin1', () => {
    const sent = Buffer.from('Lecție.pdf', 'utf8').toString('latin1');
    expect(cleanFileName(sent)).toBe('Lecție.pdf');
  });

  it('drops folders and control characters and ends in .pdf', () => {
    expect(cleanFileName('C:\\Users\\ana\\notes\u0007.pdf')).toBe('notes.pdf');
    expect(cleanFileName('../../etc/passwd')).toBe('passwd.pdf');
    expect(cleanFileName('')).toBe('lecture.pdf');
  });
});
