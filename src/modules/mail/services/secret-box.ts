/** Reversible encryption for secrets that have to be read back, like an SMTP password. */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
/** Fixed salt: the key must be reproducible across restarts and instances. */
const SALT = 'pzee.mail.settings';
const PREFIX = 'enc.v1.';

/**
 * A password bcrypt cannot help with.
 *
 * Passwords are normally hashed, because nothing needs to read them back. An
 * SMTP password does: the server has to present it to Gmail on every send. So
 * it is encrypted instead, with a key derived from `JWT_SECRET` — which already
 * has to be secret, already differs between development and production, and is
 * already never committed.
 *
 * The consequence is worth stating plainly: rotating `JWT_SECRET` makes a
 * stored mail password unreadable, and it has to be entered again on the
 * settings page. That is the same trade every reversible secret carries.
 */
export function encryptSecret(plain: string, keySource: string): string {
  const key = scryptSync(keySource, SALT, 32);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);

  return [
    PREFIX + iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

/**
 * Returns null rather than throwing when the value cannot be read — a wrong or
 * rotated key should surface as "mail is not configured", not as a crash on
 * every send.
 */
export function decryptSecret(stored: string, keySource: string): string | null {
  if (!stored.startsWith(PREFIX)) return null;

  // "enc.v1.<iv>.<tag>.<payload>" — base64 never contains a dot, so splitting
  // on one is unambiguous.
  const parts = stored.split('.');
  if (parts.length !== 5) return null;

  const [, , ivPart, tagPart, payload] = parts;

  try {
    const key = scryptSync(keySource, SALT, 32);
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivPart, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(tagPart, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(payload, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
