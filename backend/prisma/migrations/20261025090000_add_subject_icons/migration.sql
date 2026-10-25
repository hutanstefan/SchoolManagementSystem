-- Subject icons: the admin picks one from a fixed list, next to the colour.

-- CreateEnum
CREATE TYPE "SubjectIcon" AS ENUM ('BOOK', 'CALCULATOR', 'SIGMA', 'PI', 'RULER', 'SHAPES', 'PUZZLE', 'ATOM', 'MAGNET', 'FLASK', 'DNA', 'MICROSCOPE', 'LEAF', 'HEART', 'BRAIN', 'TELESCOPE', 'LANDMARK', 'SCROLL', 'GLOBE', 'MOUNTAIN', 'COMPASS', 'LANGUAGES', 'FEATHER', 'PENCIL', 'MESSAGE', 'LAPTOP', 'CODE', 'CPU', 'WRENCH', 'LIGHTBULB', 'PALETTE', 'MUSIC', 'DRAMA', 'CAMERA', 'DUMBBELL', 'SCALE', 'TRENDING', 'USERS', 'CHURCH', 'GRADUATION');

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN "icon" "SubjectIcon" NOT NULL DEFAULT 'BOOK';

-- Existing subjects keep the icon the app used to guess from their name.
UPDATE "subjects" SET "icon" = CASE
    WHEN "name" ~* 'sport|physical education|gym' THEN 'DUMBBELL'
    WHEN "name" ~* 'math|algebra|geometr' THEN 'CALCULATOR'
    WHEN "name" ~* 'physic' THEN 'ATOM'
    WHEN "name" ~* 'chemi' THEN 'FLASK'
    WHEN "name" ~* 'biolog|science' THEN 'LEAF'
    WHEN "name" ~* 'histor' THEN 'LANDMARK'
    WHEN "name" ~* 'geograph' THEN 'GLOBE'
    WHEN "name" ~* 'english|romanian|french|german|spanish|latin|language|literat' THEN 'LANGUAGES'
    WHEN "name" ~* 'comput|informati|program|ict' THEN 'LAPTOP'
    WHEN "name" ~* '\yart\y|drawing|design' THEN 'PALETTE'
    WHEN "name" ~* 'music' THEN 'MUSIC'
    ELSE 'BOOK'
END::"SubjectIcon";
