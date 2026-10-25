import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BACKEND_ROOT, storageRoot } from './create-storage';
import { LocalFileStorage } from './local-storage';

describe('LocalFileStorage', () => {
  let dir: string;
  let storage: LocalFileStorage;
  const options = {
    disposition: 'inline' as const,
    fileName: 'notes.pdf',
    contentType: 'application/pdf',
  };
  const tokenOf = (url: string) => url.split('/').pop()!;
  const read = async (token: string) => {
    const file = await storage.open(token);
    if (typeof file === 'string') return file;
    const chunks: Buffer[] = [];
    for await (const chunk of file.stream) chunks.push(chunk as Buffer);
    return { ...file, data: Buffer.concat(chunks).toString() };
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'storage-'));
    storage = new LocalFileStorage(dir, 'a-secret', 60);
    await storage.put('lectures/a.pdf', Buffer.from('%PDF-1.4 a'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('keeps files in the folder, under their key', async () => {
    expect(await readFile(join(dir, 'lectures/a.pdf'), 'utf8')).toBe(
      '%PDF-1.4 a',
    );
  });

  it('opens a file through a signed link, with how to show it', async () => {
    const link = await storage.link('lectures/a.pdf', options);
    expect(link.url).toMatch(/^\/api\/files\/[\w-]+\.[\w-]+$/);
    expect(link.expiresAt.getTime()).toBeGreaterThan(Date.now() + 59_000);

    expect(await read(tokenOf(link.url))).toMatchObject({
      data: '%PDF-1.4 a',
      size: 10,
      contentType: 'application/pdf',
      disposition: 'inline',
      fileName: 'notes.pdf',
    });
  });

  it('refuses a changed, foreign or expired link', async () => {
    const token = tokenOf((await storage.link('lectures/a.pdf', options)).url);
    const [body, signature] = token.split('.');
    // Another file in the same signed envelope.
    const other = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body, 'base64url').toString()),
        k: 'lectures/b.pdf',
      }),
    ).toString('base64url');
    expect(await storage.open(`${other}.${signature}`)).toBe('invalid');
    expect(await storage.open(`${body}.${signature.slice(1)}x`)).toBe(
      'invalid',
    );
    expect(await storage.open('nonsense')).toBe('invalid');

    const elsewhere = new LocalFileStorage(dir, 'another-secret', 60);
    expect(await elsewhere.open(token)).toBe('invalid');

    const expired = new LocalFileStorage(dir, 'a-secret', -1);
    const old = await expired.link('lectures/a.pdf', options);
    expect(await storage.open(tokenOf(old.url))).toBe('expired');
  });

  it('removes files, and does not mind one that is already gone', async () => {
    await storage.remove('lectures/a.pdf');
    await storage.remove('lectures/a.pdf');
    const link = await storage.link('lectures/a.pdf', options);
    expect(await storage.open(tokenOf(link.url))).toBe('missing');
  });

  it('never leaves its folder', async () => {
    await expect(
      storage.put('../outside.pdf', Buffer.from('x')),
    ).rejects.toThrow('Invalid storage key');
    await expect(storage.link('/etc/passwd', options)).rejects.toThrow();
  });
});

describe('storageRoot', () => {
  it('puts a relative folder in the backend folder, wherever the API starts', () => {
    expect(storageRoot('storage')).toBe(join(BACKEND_ROOT, 'storage'));
    expect(BACKEND_ROOT.endsWith('backend')).toBe(true);
    expect(storageRoot('/app/storage')).toBe('/app/storage');
  });
});
