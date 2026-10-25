-- Access to a lecture no longer ends with the school year: it stays until
-- the teacher removes it. Every change of who can read a lecture is kept in
-- lecture_access_events.

-- CreateEnum
CREATE TYPE "LectureAccessAction" AS ENUM ('GRANTED', 'REVOKED');

-- CreateTable
CREATE TABLE "lecture_access_events" (
    "id" UUID NOT NULL,
    "lecture_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "action" "LectureAccessAction" NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecture_access_events_pkey" PRIMARY KEY ("id")
);

-- The history so far: every grant, given by the lecture's teacher...
INSERT INTO "lecture_access_events" ("id", "lecture_id", "student_id", "action", "actor_id", "created_at")
SELECT gen_random_uuid(), a."lecture_id", a."student_id", 'GRANTED', t."user_id", a."granted_at"
FROM "lecture_access" AS a
JOIN "lectures" AS l ON l."id" = a."lecture_id"
LEFT JOIN "teachers" AS t ON t."id" = l."teacher_id";

-- ...and the grants of closed years, which ended when the year was closed.
INSERT INTO "lecture_access_events" ("id", "lecture_id", "student_id", "action", "actor_id", "created_at")
SELECT gen_random_uuid(), a."lecture_id", a."student_id", 'REVOKED', NULL, COALESCE(y."closed_at", CURRENT_TIMESTAMP)
FROM "lecture_access" AS a
JOIN "school_years" AS y ON y."id" = a."school_year_id"
WHERE y."status" = 'CLOSED';

-- Only the open year's grants are still valid: one row per lecture and student.
DELETE FROM "lecture_access" AS a
USING "school_years" AS y
WHERE y."id" = a."school_year_id" AND y."status" = 'CLOSED';

ALTER TABLE "lecture_access" DROP CONSTRAINT "lecture_access_school_year_id_fkey";
ALTER TABLE "lecture_access" DROP CONSTRAINT "lecture_access_pkey";
DROP INDEX "lecture_access_student_id_school_year_id_idx";
DROP INDEX "lecture_access_school_year_id_idx";
ALTER TABLE "lecture_access" DROP COLUMN "school_year_id";
ALTER TABLE "lecture_access" ADD CONSTRAINT "lecture_access_pkey" PRIMARY KEY ("lecture_id", "student_id");

-- CreateIndex
CREATE INDEX "lecture_access_student_id_idx" ON "lecture_access"("student_id");

-- CreateIndex
CREATE INDEX "lecture_access_events_lecture_id_created_at_idx" ON "lecture_access_events"("lecture_id", "created_at");

-- CreateIndex
CREATE INDEX "lecture_access_events_student_id_idx" ON "lecture_access_events"("student_id");

-- CreateIndex
CREATE INDEX "lecture_access_events_actor_id_idx" ON "lecture_access_events"("actor_id");

-- AddForeignKey
ALTER TABLE "lecture_access_events" ADD CONSTRAINT "lecture_access_events_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_access_events" ADD CONSTRAINT "lecture_access_events_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_access_events" ADD CONSTRAINT "lecture_access_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
