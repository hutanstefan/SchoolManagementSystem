import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanupTestData,
  createTestApp,
  loginAs,
  PASSWORD,
  TestApp,
  uniqueName,
} from './utils';

/** Each test gets a fresh app, so the login rate limit starts from zero. */
describe('Auth (e2e)', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await cleanupTestData(app);
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
      student: {
        class: { name: '9A' },
        registrationNumber: expect.stringMatching(/^\d{4}-\d{4}$/),
      },
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

  it('accepts only HS256 tokens, even when signed with the right secret', async () => {
    const jwt = app.get(JwtService);
    const user = await app.get(PrismaService).user.findUniqueOrThrow({
      where: { email: 'admin@school.test' },
    });
    const payload = { sub: user.id, role: user.role, ver: user.tokenVersion };
    const hs512 = await jwt.signAsync(payload, { algorithm: 'HS512' });
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${hs512}`)
      .expect(401);

    // An unsigned token ("alg": "none") is refused too.
    const encode = (part: object) =>
      Buffer.from(JSON.stringify(part)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 600,
    })}.`;
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${unsigned}`)
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

  describe('logout', () => {
    it('invalidates the token immediately', async () => {
      // A throwaway account, so seeded users keep their sessions.
      const adminToken = await loginAs(app, 'admin');
      const email = `${uniqueName('logout')}@school.test`;
      await request(app.getHttpServer())
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          password: 'Welcome123',
          firstName: 'Log',
          lastName: 'Out',
          dateOfBirth: '2011-01-01',
        })
        .expect(201);
      const { body } = await login(email, 'Welcome123').expect(200);
      const auth = `Bearer ${body.accessToken}`;

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', auth)
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', auth)
        .expect(204);

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', auth)
        .expect(401);
      expect(response.body.message).toBe(
        'Session has ended, please log in again',
      );

      // Logging in again gives a new, working token.
      const { body: again } = await login(email, 'Welcome123').expect(200);
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${again.accessToken}`)
        .expect(200);
    });

    it('requires a token', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    });
  });
});
