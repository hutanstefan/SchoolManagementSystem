import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { S3FileStorage } from '../src/storage/s3-storage';

/**
 * The S3 driver against a real S3-compatible server. Skipped unless
 * S3_TEST_ENDPOINT is set, e.g. with a local mock server:
 *   pip install "moto[server]" && moto_server -p 5055
 *   S3_TEST_ENDPOINT=http://127.0.0.1:5055 npm run test:e2e -- storage-s3
 * (MinIO works too.) Against Cloudflare R2, use a test bucket.
 */
const endpoint = process.env.S3_TEST_ENDPOINT;
const describeIf = endpoint ? describe : describe.skip;

describeIf('S3 storage (e2e)', () => {
  const bucket = `lectures-test-${Date.now()}`;
  const credentials = {
    accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? 'test',
    secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? 'test',
  };
  let storage: S3FileStorage;

  beforeAll(async () => {
    const client = new S3Client({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials,
    });
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    storage = new S3FileStorage({
      endpoint: endpoint!,
      region: 'auto',
      bucket,
      ...credentials,
      forcePathStyle: true,
      linkSeconds: 60,
    });
  });

  it('stores a file and serves it through pre-signed links only', async () => {
    await storage.put(
      'lectures/test.pdf',
      Buffer.from('%PDF-1.4 hello'),
      'application/pdf',
    );
    for (const disposition of ['inline', 'attachment'] as const) {
      const link = await storage.link('lectures/test.pdf', {
        disposition,
        fileName: 'Lecție.pdf',
        contentType: 'application/pdf',
      });
      const res = await fetch(link.url);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/pdf');
      expect(res.headers.get('content-disposition')).toMatch(
        new RegExp(`^${disposition}; filename="Lectie.pdf"`),
      );
      expect(await res.text()).toBe('%PDF-1.4 hello');
    }
    // Without a signature, the private bucket says no.
    const plain = (
      await storage.link('lectures/test.pdf', {
        disposition: 'inline',
        fileName: 'a.pdf',
        contentType: 'application/pdf',
      })
    ).url.split('?')[0];
    expect((await fetch(plain)).ok).toBe(false);
  });

  it('removes files', async () => {
    await storage.remove('lectures/test.pdf');
    const link = await storage.link('lectures/test.pdf', {
      disposition: 'inline',
      fileName: 'a.pdf',
      contentType: 'application/pdf',
    });
    expect((await fetch(link.url)).ok).toBe(false);
  });
});
