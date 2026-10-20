import type { Weekday } from '../generated/prisma/client';
import { PersonSummaryDto } from './dto/summaries.dto';

/** Prisma select for a teacher or student shown as a PersonSummaryDto. */
export const personSelect = {
  id: true,
  user: { select: { firstName: true, lastName: true } },
} as const;

type PersonRow = { id: string; user: { firstName: string; lastName: string } };

export function toPerson(person: PersonRow): PersonSummaryDto;
export function toPerson(person: PersonRow | null): PersonSummaryDto | null;
export function toPerson(person: PersonRow | null): PersonSummaryDto | null {
  return person
    ? {
        id: person.id,
        firstName: person.user.firstName,
        lastName: person.user.lastName,
      }
    : null;
}

export function fullName(person: {
  user: { firstName: string; lastName: string };
}): string {
  return `${person.user.firstName} ${person.user.lastName}`;
}

/** "MONDAY", 2 -> "Monday, period 2" (used in error messages). */
export function formatSlot(day: Weekday, period: number): string {
  return `${day.charAt(0)}${day.slice(1).toLowerCase()}, period ${period}`;
}
