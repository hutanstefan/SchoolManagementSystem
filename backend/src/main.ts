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

  const port = app
    .get<ConfigService<Env, true>>(ConfigService)
    .get('PORT', { infer: true });

  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`API docs on http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
