import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** The OpenAPI document of the API (also exported to docs/openapi.json). */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('School Management System API')
    .setDescription(
      'REST API for managing students, teachers, classes, timetables and grades.\n\n' +
        'Log in with `POST /api/auth/login` (test accounts are listed in the README), ' +
        'then click **Authorize** and paste the `accessToken`.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config);
}

/** Interactive API documentation at /api/docs (raw OpenAPI JSON at /api/docs-json). */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, createOpenApiDocument(app), {
    swaggerOptions: { persistAuthorization: true },
  });
}
