import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://school:school@127.0.0.1:5432/school_db',
  JWT_SECRET: 'a-secret-that-is-long-enough-for-the-checks-1234',
};
const s3 = {
  ...base,
  STORAGE_DRIVER: 's3',
  S3_BUCKET: 'sms-lectures',
  S3_ACCESS_KEY_ID: 'key-id',
  S3_SECRET_ACCESS_KEY: 'secret',
};

describe('validateEnv: S3 storage', () => {
  it('needs the bucket settings with STORAGE_DRIVER=s3', () => {
    expect(() => validateEnv({ ...base, STORAGE_DRIVER: 's3' })).toThrow(
      /S3_ENDPOINT/,
    );
  });

  it('adds https:// to an endpoint written without it', () => {
    const env = validateEnv({
      ...s3,
      S3_ENDPOINT: 's3.us-east-005.backblazeb2.com',
      S3_REGION: 'us-east-005',
    });
    expect(env.S3_ENDPOINT).toBe('https://s3.us-east-005.backblazeb2.com');
  });

  it('wants the region of a Backblaze B2 or AWS endpoint', () => {
    expect(() =>
      validateEnv({
        ...s3,
        S3_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com',
        S3_REGION: 'eu-central-003',
      }),
    ).toThrow(/S3_REGION.*us-east-005/);
  });

  it('takes Cloudflare R2 with the "auto" region', () => {
    const env = validateEnv({
      ...s3,
      S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
    });
    expect(env.S3_REGION).toBe('auto');
  });
});
