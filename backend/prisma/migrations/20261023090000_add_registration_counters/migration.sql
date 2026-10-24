-- The last registration number given in each year, so a number is never given
-- twice, even after its student is deleted.
CREATE TABLE "registration_counters" (
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL,

    CONSTRAINT "registration_counters_pkey" PRIMARY KEY ("year")
);

-- Start from the numbers given so far ("2026-0042" -> year 2026, number 42).
INSERT INTO "registration_counters" ("year", "last_number")
SELECT CAST(split_part("registration_number", '-', 1) AS INTEGER),
       MAX(CAST(split_part("registration_number", '-', 2) AS INTEGER))
FROM "students"
GROUP BY 1;
