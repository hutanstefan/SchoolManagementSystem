import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { assertSafeZip, UnsafeZipError } from './zip-guard';

async function zipOf(
  files: Record<string, string | Buffer>,
  compression: 'DEFLATE' | 'STORE' = 'DEFLATE',
): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: 'nodebuffer', compression });
}

describe('assertSafeZip', () => {
  it('accepts a real spreadsheet', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Grades');
    sheet.addRow(['Class', 'Last name', 'First name', 'Grade']);
    for (let i = 0; i < 300; i++) sheet.addRow(['9A', `Name${i}`, 'Ion', 8]);
    const data = Buffer.from(await workbook.xlsx.writeBuffer());

    expect(() => assertSafeZip(data)).not.toThrow();
  });

  it('refuses a small file that unpacks to too much (zip bomb)', async () => {
    // 50 MB of zeros compress to about 50 KB.
    const bomb = await zipOf({
      'xl/sheet1.xml': Buffer.alloc(50 * 1024 * 1024),
    });
    expect(bomb.length).toBeLessThan(200 * 1024);

    expect(() => assertSafeZip(bomb)).toThrow('too large once unpacked');
  });

  it('counts every part, stored or compressed', async () => {
    const parts = await zipOf(
      { a: Buffer.alloc(600), b: Buffer.alloc(600) },
      'STORE',
    );
    expect(() => assertSafeZip(parts, 1000)).toThrow(UnsafeZipError);
    expect(() => assertSafeZip(parts, 2000)).not.toThrow();
  });

  it('refuses something that is not a zip', () => {
    expect(() => assertSafeZip(Buffer.from('PK not really a zip'))).toThrow(
      'Not a zip file',
    );
  });
});
