import * as bcrypt from 'bcrypt';

/** bcrypt cost factor: ~50-100 ms per hash, slow enough to resist brute force. */
export const BCRYPT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
