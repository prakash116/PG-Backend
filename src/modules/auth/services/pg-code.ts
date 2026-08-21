/** Generates the short, shareable PG identifier shown to owners. */
import { randomInt } from 'node:crypto';

/**
 * Digits 0/1 and letters I/O are left out so a code stays unambiguous when it
 * is read aloud, handwritten, or typed from a photo.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;
const PREFIX = 'PZ-';

/** Returns a code such as `PZ-4F7K2A`. Uniqueness is enforced by the database. */
export function generatePgCode(): string {
  let code = '';

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }

  return PREFIX + code;
}
