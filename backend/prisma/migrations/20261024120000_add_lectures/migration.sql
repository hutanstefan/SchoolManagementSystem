-- Lectures: PDFs a teacher shares with the students they choose. The files
-- are kept in the storage (a local folder or an S3-compatible bucket); the
-- database only stores where they are.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LECTURE_SHARED';

-- CreateTable
CREATE TABLE "lectures" (
    "id" UUID NOT NULL,
    "teacher_id" UUID,
    "subject_id" UUID NOT NULL,
    "school_year_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lectures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lectures_file_size_check" CHECK ("file_size" > 0),
    CONSTRAINT "lectures_title_check" CHECK (length("title") BETWEEN 1 AND 120)
);

-- CreateTable
CREATE TABLE "lecture_access" (
    "lecture_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecture_access_pkey" PRIMARY KEY ("lecture_id","student_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lectures_file_key_key" ON "lectures"("file_key");

-- CreateIndex
CREATE INDEX "lectures_teacher_id_idx" ON "lectures"("teacher_id");

-- CreateIndex
CREATE INDEX "lectures_school_year_id_idx" ON "lectures"("school_year_id");

-- CreateIndex
CREATE INDEX "lecture_access_student_id_idx" ON "lecture_access"("student_id");

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_access" ADD CONSTRAINT "lecture_access_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_access" ADD CONSTRAINT "lecture_access_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
