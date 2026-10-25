import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { ClassSubjectsModule } from './class-subjects/class-subjects.module';
import { ClassesModule } from './classes/classes.module';
import { GradeImportsModule } from './grade-imports/grade-imports.module';
import { GradeScansModule } from './grade-scans/grade-scans.module';
import { LecturesModule } from './lectures/lectures.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { validateEnv } from './config/env.validation';
import { GradesModule } from './grades/grades.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { SchoolYearsModule } from './school-years/school-years.module';
import { StatsModule } from './stats/stats.module';
import { StorageModule } from './storage/storage.module';
import { StudentsModule } from './students/students.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TeachersModule } from './teachers/teachers.module';
import { TimetableModule } from './timetable/timetable.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    // Default limit for every route; stricter limits are set per route (e.g. login).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    // Domain events (a grade was given, the timetable changed...), see src/events.
    EventEmitterModule.forRoot(),
    PrismaModule,
    StorageModule,
    SchoolYearsModule,
    AuthModule,
    AuditModule,
    HealthModule,
    StudentsModule,
    TeachersModule,
    ClassesModule,
    SubjectsModule,
    ClassSubjectsModule,
    TimetableModule,
    GradesModule,
    GradeScansModule,
    GradeImportsModule,
    NotificationsModule,
    ChatModule,
    StatsModule,
    LecturesModule,
  ],
  providers: [
    // Global guards run in this order for every request:
    // 1. rate limiting, 2. authentication (who are you?), 3. roles (are you allowed?).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
