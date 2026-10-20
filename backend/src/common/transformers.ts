import { Transform } from 'class-transformer';

/** Trims surrounding whitespace from string input. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** Trims and lower-cases string input (used for emails). */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

/** Query strings are always text: turns "true"/"false" into booleans. */
export const ToBoolean = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  });
