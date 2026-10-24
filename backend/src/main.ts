import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { Env } from './config/env.validation';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  setupSwagger(app);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });

  // The example secrets (README, docker-compose) are public: fine for a demo,
  // not for real data, since anyone could sign tokens with them.
  if (
    config.get('NODE_ENV', { infer: true }) === 'production' &&
    config.get('JWT_SECRET', { infer: true }).includes('change-me')
  ) {
    Logger.warn(
      'JWT_SECRET is the example value: set your own long random secret before using real data.',
      'Bootstrap',
    );
  }

  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`API docs on http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
