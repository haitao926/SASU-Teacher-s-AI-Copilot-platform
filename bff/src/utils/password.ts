import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const PREFIX = 'scrypt'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64)
  return `${PREFIX}:${salt}:${derivedKey.toString('hex')}`
}

export function verifyPassword(rawPassword: string, stored: string): boolean {
  if (!stored) return false

  // New format: scrypt:<salt>:<hash>
  if (stored.startsWith(`${PREFIX}:`)) {
    const [, salt, hashed] = stored.split(':')
    if (!salt || !hashed) return false
    const derived = scryptSync(rawPassword, salt, 64)
    const hashedBuf = Buffer.from(hashed, 'hex')
    return hashedBuf.length === derived.length && timingSafeEqual(derived, hashedBuf)
  }

  // Backward compatibility: fall back to plain-text match (should be phased out)
  return stored === rawPassword
}
