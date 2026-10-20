import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Password policy for accounts created by the admin. */
export const IsValidPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(8),
    MaxLength(128),
    Matches(/[A-Za-z]/, { message: 'password must contain a letter' }),
    Matches(/\d/, { message: 'password must contain a digit' }),
  );
