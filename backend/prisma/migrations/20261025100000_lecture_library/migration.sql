-- Lectures become the teacher's library: a lecture is no longer tied to a
-- school year. Access is instead: each grant is for one school year and ends with
-- it. The teacher shares the lecture again the next year; the old grants stay
-- as history.

-- Grants made so far were for the lecture's year.
ALTER TABLE "lecture_access" ADD COLUMN "school_year_id" UUID;

UPDATE "lecture_access" AS a
SET "school_year_id" = l."school_year_id"
FROM "lectures" AS l
WHERE l."id" = a."lecture_id";

ALTER TABLE "lecture_access" ALTER COLUMN "school_year_id" SET NOT NULL;

-- A student can have the same lecture in several years.
ALTER TABLE "lecture_access" DROP CONSTRAINT "lecture_access_pkey";
ALTER TABLE "lecture_access" ADD CONSTRAINT "lecture_access_pkey" PRIMARY KEY ("lecture_id", "school_year_id", "student_id");

DROP INDEX "lecture_access_student_id_idx";
CREATE INDEX "lecture_access_student_id_school_year_id_idx" ON "lecture_access"("student_id", "school_year_id");
CREATE INDEX "lecture_access_school_year_id_idx" ON "lecture_access"("school_year_id");

ALTER TABLE "lecture_access" ADD CONSTRAINT "lecture_access_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The lecture itself has no year any more.
ALTER TABLE "lectures" DROP CONSTRAINT "lectures_school_year_id_fkey";
DROP INDEX "lectures_school_year_id_idx";
ALTER TABLE "lectures" DROP COLUMN "school_year_id";
