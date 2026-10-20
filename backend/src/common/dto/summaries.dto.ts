/** Small embedded objects reused across responses. */

export class ClassSummaryDto {
  id!: string;
  /** @example 9A */
  name!: string;
}

export class SubjectSummaryDto {
  id!: string;
  /** @example Mathematics */
  name!: string;
}

export class PersonSummaryDto {
  /** Teacher or student id (not the user id). */
  id!: string;
  /** @example Mihai */
  firstName!: string;
  /** @example Ionescu */
  lastName!: string;
}
