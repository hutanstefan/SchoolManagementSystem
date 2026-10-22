import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DemoTestReader } from '../src/grade-scans/readers/demo-test-reader';
import { TEST_READER } from '../src/grade-scans/readers/test-reader';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Helpers for e2e tests. They run against the seeded database
 * (`npm run db:seed`); records created by a test use the E2E_PREFIX in their
 * email or name and are cleaned up afterwards.
 */
export const PASSWORD = 'Password123!';
export const E2E_PREFIX = 'e2e-';

export type TestApp = INestApplication<App>;

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Tests never call the real AI API, even if ANTHROPIC_API_KEY is set.
    .overrideProvider(TEST_READER)
    .useValue(new DemoTestReader())
    .compile();
  const app = moduleRef.createNestApplication<TestApp>();
  configureApp(app);
  await app.init();
  return app;
}

/**
 * Token for a seeded account, signed directly instead of calling /auth/login,
 * so feature tests don't use up the login rate limit (5/min).
 * The login flow itself is covered by auth.e2e-spec.ts.
 */
export async function loginAs(
  app: TestApp,
  role: 'admin' | 'teacher' | 'student',
): Promise<string> {
  const user = await app.get(PrismaService).user.findUniqueOrThrow({
    where: { email: `${role}@school.test` },
    select: { id: true, role: true, tokenVersion: true },
  });
  return app
    .get(JwtService)
    .signAsync({ sub: user.id, role: user.role, ver: user.tokenVersion });
}

/** Deletes everything e2e tests created (users, classes, subjects). */
export async function cleanupTestData(app: TestApp): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.user.deleteMany({
    where: { email: { startsWith: E2E_PREFIX } },
  });
  await prisma.class.deleteMany({
    where: { name: { startsWith: E2E_PREFIX.toUpperCase() } },
  });
  await prisma.subject.deleteMany({
    where: { name: { startsWith: E2E_PREFIX } },
  });
}

/** A unique, recognisable value for test records. */
export function uniqueName(label: string): string {
  return `${E2E_PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Class names are limited to 20 characters, e.g. "E2E-482913". */
export function uniqueClassName(): string {
  return `${E2E_PREFIX.toUpperCase()}${Math.floor(100000 + Math.random() * 900000)}`;
}
