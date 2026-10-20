import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/**
 * Runs against the seeded database (`npm run db:seed`).
 * Each test file gets a fresh app, so the login rate limit starts from zero.
 */
const PASSWORD = 'Password123!';

async function createApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const login = (email: string, password = PASSWORD) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });

  it.each([
    ['admin@school.test', 'ADMIN'],
    ['teacher@school.test', 'TEACHER'],
    ['student@school.test', 'STUDENT'],
  ])('logs in %s as %s', async (email, role) => {
    const response = await login(email).expect(200);

    expect(response.body).toMatchObject({
      tokenType: 'Bearer',
      user: { email, role },
    });
    expect(typeof response.body.accessToken).toBe('string');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('accepts the email in any case and with surrounding spaces', async () => {
    await login('  Admin@School.TEST ').expect(200);
  });

  it('rejects a wrong password with a generic message', async () => {
    const response = await login('admin@school.test', 'wrong').expect(401);
    expect(response.body.message).toBe('Invalid email or password');
  });

  it('rejects an unknown email with the same generic message', async () => {
    const response = await login('nobody@school.test').expect(401);
    expect(response.body.message).toBe('Invalid email or password');
  });

  it('validates the request body and rejects unknown fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '', role: 'ADMIN' })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'property role should not exist',
        'email must be an email',
      ]),
    );
  });

  it('returns the current user from GET /auth/me', async () => {
    const { body } = await login('student@school.test');

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      email: 'student@school.test',
      role: 'STUDENT',
      student: { class: { name: '9A' } },
      teacher: null,
    });
  });

  it('rejects GET /auth/me without a token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);
    expect(response.body.message).toBe('Missing access token');
  });

  it('rejects GET /auth/me with an invalid token', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real-token')
      .expect(401);
  });

  it('keeps public routes open without a token', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('rate-limits login to 5 attempts per minute', async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await login('admin@school.test', 'wrong').expect(401);
    }
    await login('admin@school.test', 'wrong').expect(429);
  });
});
