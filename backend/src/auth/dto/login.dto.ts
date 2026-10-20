import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  /**
   * Case-insensitive: it is trimmed and lower-cased before lookup.
   * @example admin@school.test
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** @example Password123! */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
