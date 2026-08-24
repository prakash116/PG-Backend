/** Short, shareable codes: the PG identifier and a customer's referral code. */
import { randomInt } from 'node:crypto';

/**
 * Digits 0/1 and letters I/O are left out so a code stays unambiguous when it
 * is read aloud, handwritten, or typed from a photo.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;

function randomCode(prefix: string): string {
  let code = '';

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }

  return prefix + code;
}

/** Returns a code such as `PZ-4F7K2A`. Uniqueness is enforced by the database. */
export function generatePgCode(): string {
  return randomCode('PZ-');
}

/**
 * Returns a code such as `PZR-4F7K2A`, which a customer gives a PG owner to
 * enter at registration. The `R` keeps it visibly distinct from a PG code, so
 * neither gets typed into the other's box. Uniqueness is enforced by the
 * database.
 */
export function generateReferralCode(): string {
  return randomCode('PZR-');
}
