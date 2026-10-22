-- Registration numbers become "<year of enrollment>-<number in that year>",
-- e.g. "2026-0042". Existing students keep their order; the year is the one
-- their account was created in.
ALTER TABLE "students" ALTER COLUMN "registration_number" DROP DEFAULT;
ALTER TABLE "students" ALTER COLUMN "registration_number" SET DATA TYPE TEXT USING "registration_number"::TEXT;
DROP SEQUENCE IF EXISTS "students_registration_number_seq";

UPDATE "students" AS s
SET "registration_number" = numbered.value
FROM (
    SELECT st."id",
           to_char(u."created_at", 'YYYY') || '-' ||
           lpad(row_number() OVER (
               PARTITION BY to_char(u."created_at", 'YYYY')
               ORDER BY st."registration_number"::INTEGER
           )::TEXT, 4, '0') AS value
    FROM "students" AS st
    JOIN "users" AS u ON u."id" = st."user_id"
) AS numbered
WHERE numbered."id" = s."id";
