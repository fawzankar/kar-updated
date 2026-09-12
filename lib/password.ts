import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64) as Buffer
  return `scrypt:${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, encoded] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !encoded) return false
  const derived = await scrypt(password, salt, 64) as Buffer
  const expected = Buffer.from(encoded, 'hex')
  return expected.length === derived.length && derived.equals(expected)
}
