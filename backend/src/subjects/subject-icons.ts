import { SubjectIcon } from '../generated/prisma/enums';

/** Name patterns and the icon that fits them; the first match wins. */
const GUESSES: [RegExp, SubjectIcon][] = [
  [/sport|physical education|\bpe\b|gym/i, SubjectIcon.DUMBBELL],
  [/math|algebra|geometr|calcul/i, SubjectIcon.CALCULATOR],
  [/program|coding|software/i, SubjectIcon.CODE],
  [/comput|informati|\bict\b|\bit\b/i, SubjectIcon.LAPTOP],
  [/astronom/i, SubjectIcon.TELESCOPE],
  [/physic/i, SubjectIcon.ATOM],
  [/chemi/i, SubjectIcon.FLASK],
  [/biolog|anatom/i, SubjectIcon.DNA],
  [/science|nature|ecolog/i, SubjectIcon.LEAF],
  [/health|medic/i, SubjectIcon.HEART],
  [/psycholog|philosoph|logic/i, SubjectIcon.BRAIN],
  [/histor/i, SubjectIcon.LANDMARK],
  [/geograph/i, SubjectIcon.GLOBE],
  [/econom|business|financ/i, SubjectIcon.TRENDING],
  [/civic|law|politic/i, SubjectIcon.SCALE],
  [/sociolog|social/i, SubjectIcon.USERS],
  [/religio|theolog/i, SubjectIcon.CHURCH],
  [/literat|writing|poetry/i, SubjectIcon.FEATHER],
  [
    /english|romanian|french|german|spanish|italian|latin|language/i,
    SubjectIcon.LANGUAGES,
  ],
  [/electronic|robot/i, SubjectIcon.CPU],
  [/technolog|engineer/i, SubjectIcon.WRENCH],
  [/music|choir/i, SubjectIcon.MUSIC],
  [/drama|theat/i, SubjectIcon.DRAMA],
  [/photo|media|film/i, SubjectIcon.CAMERA],
  [/\bart\b|arts|drawing|design|paint/i, SubjectIcon.PALETTE],
  [/counsel|tutor|homeroom|class master/i, SubjectIcon.GRADUATION],
];

/** An icon that fits the subject's name, or a book when nothing fits. */
export function iconForName(name: string): SubjectIcon {
  return (
    GUESSES.find(([pattern]) => pattern.test(name))?.[1] ?? SubjectIcon.BOOK
  );
}
