import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { GradesModule } from '../grades/grades.module';
import { GradeScansController } from './grade-scans.controller';
import { GradeScansService } from './grade-scans.service';
import { createTestReader } from './readers/create-test-reader';
import { ResilientTestReader } from './readers/resilient-test-reader';
import { TEST_READER, type TestReader } from './readers/test-reader';

@Module({
  imports: [GradesModule],
  controllers: [GradeScansController],
  providers: [
    GradeScansService,
    {
      // Gemini, Claude or the demo reader, depending on the configuration.
      provide: TEST_READER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): TestReader => {
        const reader = createTestReader({
          AI_PROVIDER: config.get('AI_PROVIDER', { infer: true }),
          GEMINI_API_KEY: config.get('GEMINI_API_KEY', { infer: true }),
          GEMINI_MODEL: config.get('GEMINI_MODEL', { infer: true }),
          GEMINI_FALLBACK_MODELS: config.get('GEMINI_FALLBACK_MODELS', {
            infer: true,
          }),
          ANTHROPIC_API_KEY: config.get('ANTHROPIC_API_KEY', { infer: true }),
          ANTHROPIC_MODEL: config.get('ANTHROPIC_MODEL', { infer: true }),
          AI_RETRY_SECONDS: config.get('AI_RETRY_SECONDS', { infer: true }),
        });
        const logger = new Logger('GradeScans');
        if (reader.mode === 'demo') {
          logger.warn('No AI key configured: test scanning runs in demo mode.');
        } else {
          const models =
            reader instanceof ResilientTestReader
              ? reader.models.join(', then ')
              : reader.model;
          logger.log(`Test scanning uses ${models}.`);
        }
        return reader;
      },
    },
  ],
})
export class GradeScansModule {}
