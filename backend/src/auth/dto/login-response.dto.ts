import { AuthUserDto } from './auth-user.dto';

export class LoginResponseDto {
  /** JWT to send as `Authorization: Bearer <token>`. */
  accessToken!: string;
  /** @example Bearer */
  tokenType!: 'Bearer';
  /**
   * Token lifetime in seconds.
   * @example 3600
   */
  expiresIn!: number;
  user!: AuthUserDto;
}
