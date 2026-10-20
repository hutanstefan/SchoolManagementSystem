import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Interactive API documentation at /api/docs (raw OpenAPI JSON at /api/docs-json). */
export function setupSwagger(app: INestApplication): void {
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

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
