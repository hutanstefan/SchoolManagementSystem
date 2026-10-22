-- Registration number (număr matricol): given in order from 1001. Existing
-- students get theirs when the column is added.
CREATE SEQUENCE "students_registration_number_seq" START WITH 1001;

-- AlterTable
ALTER TABLE "students" ADD COLUMN "registration_number" INTEGER NOT NULL DEFAULT nextval('students_registration_number_seq');
ALTER SEQUENCE "students_registration_number_seq" OWNED BY "students"."registration_number";

-- CreateIndex
CREATE UNIQUE INDEX "students_registration_number_key" ON "students"("registration_number");
