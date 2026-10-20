import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../common/transformers';

export class LoginDto {
  /**
   * Case-insensitive: it is trimmed and lower-cased before lookup.
   * @example admin@school.test
   */
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** @example Password123! */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
