import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { createOpenApiDocument } from './swagger';

/**
 * Writes the OpenAPI document to a file (default: ../docs/openapi.json) without
 * starting the server. No database is needed: providers are created, but
 * lifecycle hooks such as PrismaService.onModuleInit only run on app.init().
 *
 * Usage: npm run openapi [-- <output path>]
 */
async function exportOpenApi(): Promise<void> {
  const output = resolve(process.argv[2] ?? '../docs/openapi.json');
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  configureApp(app);

  const document = createOpenApiDocument(app);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();

  console.log(`OpenAPI document written to ${output}`);
}

void exportOpenApi();
