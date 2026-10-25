-- Absences: a student missed a lesson. Each subject of a class has a limit of
-- unexcused absences per semester.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ABSENCE_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'ABSENCE_LIMIT';

-- AlterTable: the limit, about a fifth of a semester's lessons (18 weeks).
ALTER TABLE "class_subjects" ADD COLUMN "max_absences" SMALLINT;
UPDATE "class_subjects" SET "max_absences" = FLOOR("hours_per_week" * 18 * 0.2);
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_max_absences_check" CHECK ("max_absences" BETWEEN 0 AND 200);

-- CreateTable
CREATE TABLE "absences" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "semester" SMALLINT NOT NULL,
    "date" DATE NOT NULL,
    "recorded_by_id" UUID,
    "excused" BOOLEAN NOT NULL DEFAULT false,
    "excused_at" TIMESTAMP(3),
    "excused_by_id" UUID,
    "excuse_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "absences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "absences_semester_check" CHECK ("semester" IN (1, 2)),
    CONSTRAINT "absences_excuse_note_check" CHECK ("excuse_note" IS NULL OR length("excuse_note") <= 200),
    -- An excused absence says when; an unexcused one has no excuse.
    CONSTRAINT "absences_excused_check" CHECK ("excused" = ("excused_at" IS NOT NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "absences_student_id_subject_id_date_key" ON "absences"("student_id", "subject_id", "date");

-- CreateIndex
CREATE INDEX "absences_school_year_id_semester_subject_id_idx" ON "absences"("school_year_id", "semester", "subject_id");

-- CreateIndex
CREATE INDEX "absences_student_id_school_year_id_semester_idx" ON "absences"("student_id", "school_year_id", "semester");

-- CreateIndex
CREATE INDEX "absences_recorded_by_id_idx" ON "absences"("recorded_by_id");

-- CreateIndex
CREATE INDEX "absences_excused_by_id_idx" ON "absences"("excused_by_id");

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_excused_by_id_fkey" FOREIGN KEY ("excused_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
