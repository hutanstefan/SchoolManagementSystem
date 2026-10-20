import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { Env } from './config/env.validation';

/**
 * Global app configuration shared by main.ts and the e2e tests,
 * so tests run against exactly the same setup as production.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');

  const proxyHops = config.get('TRUST_PROXY', { infer: true });
  if (proxyHops > 0) {
    (app as NestExpressApplication).set('trust proxy', proxyHops);
  }

  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties that have no validation decorator
      forbidNonWhitelisted: true, // ...and reject the request if any were sent
      transform: true, // turn payloads into DTO class instances (runs @Transform)
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}
