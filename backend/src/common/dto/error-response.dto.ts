/** Shape of every error returned by the API (see AllExceptionsFilter). */
export class ErrorResponseDto {
  /** @example 404 */
  statusCode!: number;
  /** @example Not Found */
  error!: string;
  /**
   * A message, or a list of validation messages.
   * @example Student not found
   */
  message!: string | string[];
  /** @example /api/students/0b39a733-7b2b-45e6-9d19-7938ad3af0b6 */
  path!: string;
  /** @example 2026-10-20T10:00:00.000Z */
  timestamp!: string;
}
