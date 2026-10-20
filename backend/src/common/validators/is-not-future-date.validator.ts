import { ValidateBy, ValidationOptions } from 'class-validator';
import { todayInSchool } from '../dates';

/** Validates a "YYYY-MM-DD" string that is today or earlier (school time zone). */
export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isNotFutureDate',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && value <= todayInSchool(),
        defaultMessage: (args) =>
          `${args?.property ?? 'value'} can't be in the future`,
      },
    },
    validationOptions,
  );
}
