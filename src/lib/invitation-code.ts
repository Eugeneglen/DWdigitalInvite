/**
 * R-06 (F-06): secure invitation-code generation.
 *
 * Invitation codes function as guest credentials (they authenticate a guest
 * against their invitation via /api/guests/lookup and /api/rsvp). They are
 * therefore generated with a cryptographically secure RNG — never
 * Math.random() — from an unambiguous alphabet (no 0/O/1/I) to remain
 * readable when printed on wedding cards and QR codes.
 *
 * Entropy: 8 characters from a 32-symbol alphabet = 40 bits (~1.1e12 space).
 * Combined with per-IP rate limiting on the public lookup endpoint, online
 * brute-force is impractical.
 *
 * Codes are globally unique (Guest.invitationCode @unique); callers retry
 * on collision (birthday-bound collisions remain negligible at wedding scale).
 */
import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols, no 0/O/1/I
export const INVITATION_CODE_LENGTH = 8;

export function generateInvitationCode(length: number = INVITATION_CODE_LENGTH): string {
  const len = Math.max(6, Math.min(32, length));
  const bytes = crypto.randomBytes(len);
  let code = '';
  for (let i = 0; i < len; i++) {
    // ALPHABET has exactly 32 entries, so `& 31` is a uniform (unbiased) mapping
    code += ALPHABET[bytes[i] & 31];
  }
  return code;
}
