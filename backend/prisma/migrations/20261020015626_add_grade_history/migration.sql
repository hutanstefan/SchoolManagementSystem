-- CreateEnum
CREATE TYPE "GradeAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED');

-- CreateTable
CREATE TABLE "grade_history" (
    "id" UUID NOT NULL,
    "grade_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "action" "GradeAction" NOT NULL,
    "old_value" SMALLINT,
    "new_value" SMALLINT,
    "old_date" DATE,
    "new_date" DATE,
    "changed_by_id" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grade_history_grade_id_idx" ON "grade_history"("grade_id");

-- CreateIndex
CREATE INDEX "grade_history_student_id_idx" ON "grade_history"("student_id");

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
