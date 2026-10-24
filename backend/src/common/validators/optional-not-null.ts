import { ValidateIf } from 'class-validator';

/**
 * An optional field that, when sent, can't be null: `{}` leaves it as is,
 * `{ "day": null }` is a 400. (`@IsOptional()` lets null through without
 * validating it, for fields where null means "none", like a vacant teacher.)
 */
export const OptionalNotNull = () =>
  ValidateIf((_object, value) => value !== undefined);
