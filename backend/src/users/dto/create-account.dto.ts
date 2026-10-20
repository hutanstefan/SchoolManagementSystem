import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/transformers';
import { IsValidPassword } from '../../common/validators/password';

/** Login account fields shared by students and teachers created by the admin. */
export class CreateAccountDto {
  /** @example elena.marin@school.test */
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /**
   * Initial password: at least 8 characters, with a letter and a digit.
   * @example Welcome123
   */
  @IsValidPassword()
  password!: string;

  /** @example Elena */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName!: string;

  /** @example Marin */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName!: string;
}
