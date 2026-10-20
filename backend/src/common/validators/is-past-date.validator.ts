import { ValidateBy, ValidationOptions } from 'class-validator';

/** Validates a "YYYY-MM-DD" string that lies in the past (e.g. a date of birth). */
export function IsPastDate(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isPastDate',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          !Number.isNaN(Date.parse(value)) &&
          new Date(value).getTime() < Date.now(),
        defaultMessage: (args) =>
          `${args?.property ?? 'value'} must be a date in the past`,
      },
    },
    validationOptions,
  );
}
