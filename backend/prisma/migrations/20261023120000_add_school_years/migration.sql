-- School years and semesters. Classes become one row per school year
-- ("9A" in 2026–2027), students are enrolled in a class for each year, and
-- every grade counts for a year and a semester. Existing data becomes the
-- current school year.

-- CreateEnum
CREATE TYPE "SchoolYearStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "YearOutcome" AS ENUM ('PROMOTED', 'REPEATING', 'GRADUATED');

-- CreateEnum
CREATE TYPE "SubjectColor" AS ENUM ('INDIGO', 'VIOLET', 'PINK', 'ROSE', 'ORANGE', 'AMBER', 'LIME', 'EMERALD', 'TEAL', 'SKY');

-- CreateTable
CREATE TABLE "school_years" (
    "id" UUID NOT NULL,
    "start_year" INTEGER NOT NULL,
    "status" "SchoolYearStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_semester" SMALLINT NOT NULL DEFAULT 1,
    "semester1_ended_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "outcome" "YearOutcome",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reexams" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "grade" SMALLINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reexams_pkey" PRIMARY KEY ("id")
);

-- The current school year (it starts in September), in its current semester
-- (the second one starts in February).
INSERT INTO "school_years" ("id", "start_year", "current_semester")
SELECT gen_random_uuid(),
       CASE WHEN EXTRACT(MONTH FROM now()) >= 9 THEN EXTRACT(YEAR FROM now())::INT
            ELSE EXTRACT(YEAR FROM now())::INT - 1 END,
       CASE WHEN EXTRACT(MONTH FROM now()) BETWEEN 2 AND 8 THEN 2 ELSE 1 END;

-- Classes belong to a school year; a name is unique within its year.
ALTER TABLE "classes" ADD COLUMN "school_year_id" UUID,
ADD COLUMN "previous_class_id" UUID;
UPDATE "classes" SET "school_year_id" = (SELECT "id" FROM "school_years");
ALTER TABLE "classes" ALTER COLUMN "school_year_id" SET NOT NULL;
DROP INDEX "classes_name_key";

-- Students: their class becomes an enrollment in the current year.
INSERT INTO "enrollments" ("id", "student_id", "class_id", "school_year_id")
SELECT gen_random_uuid(), s."id", s."class_id", c."school_year_id"
FROM "students" s
JOIN "classes" c ON c."id" = s."class_id";

ALTER TABLE "students" DROP CONSTRAINT "students_class_id_fkey";
DROP INDEX "students_class_id_idx";
ALTER TABLE "students" DROP COLUMN "class_id";

-- Grades count for the current year and semester.
ALTER TABLE "grades" ADD COLUMN "school_year_id" UUID,
ADD COLUMN "semester" SMALLINT;
UPDATE "grades" SET "school_year_id" = y."id", "semester" = y."current_semester"
FROM "school_years" y;
ALTER TABLE "grades" ALTER COLUMN "school_year_id" SET NOT NULL,
ALTER COLUMN "semester" SET NOT NULL;

-- Subjects get a colour; existing ones get different colours, by name.
ALTER TABLE "subjects" ADD COLUMN "color" "SubjectColor" NOT NULL DEFAULT 'INDIGO';
UPDATE "subjects" s
SET "color" = (enum_range(NULL::"SubjectColor"))[((n."position" - 1) % 10) + 1]
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "name") AS "position" FROM "subjects") n
WHERE n."id" = s."id";

-- CreateIndex
CREATE UNIQUE INDEX "classes_school_year_id_name_key" ON "classes"("school_year_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "classes_id_school_year_id_key" ON "classes"("id", "school_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_years_start_year_key" ON "school_years"("start_year");

-- CreateIndex
CREATE INDEX "enrollments_class_id_idx" ON "enrollments"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_student_id_school_year_id_key" ON "enrollments"("student_id", "school_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "reexams_student_id_school_year_id_subject_id_key" ON "reexams"("student_id", "school_year_id", "subject_id");

-- CreateIndex
CREATE INDEX "grades_school_year_id_semester_idx" ON "grades"("school_year_id", "semester");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_previous_class_id_fkey" FOREIGN KEY ("previous_class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_school_year_id_fkey" FOREIGN KEY ("class_id", "school_year_id") REFERENCES "classes"("id", "school_year_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reexams" ADD CONSTRAINT "reexams_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reexams" ADD CONSTRAINT "reexams_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reexams" ADD CONSTRAINT "reexams_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints (Prisma has no native support for them, so they are added by hand)
ALTER TABLE "school_years" ADD CONSTRAINT "school_years_current_semester_check" CHECK ("current_semester" IN (1, 2));
ALTER TABLE "grades" ADD CONSTRAINT "grades_semester_check" CHECK ("semester" IN (1, 2));
ALTER TABLE "reexams" ADD CONSTRAINT "reexams_grade_check" CHECK ("grade" BETWEEN 1 AND 10);
