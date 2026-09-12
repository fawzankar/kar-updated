import { randomBytes } from 'node:crypto'

const defaults = [
  ['imaad', 'Imaad'],
  ['adiva', 'Adiva'],
  ['ibrahim', 'Ibrahim'],
  ['shayaan', 'Shayaan'],
]
const countArg = process.argv[2]
const count = countArg == null ? defaults.length : Math.max(1, Math.min(50, Number(countArg)))
const accounts = Array.from({ length: count }, (_, index) => {
  const [username, displayName] = defaults[index] || [`user${String(index + 1).padStart(2, '0')}`, `User ${String(index + 1).padStart(2, '0')}`]
  return {
    username,
    displayName,
    password: randomBytes(12).toString('base64url'),
  }
})

console.log(JSON.stringify(accounts))
console.error('\nCopy the JSON above to INITIAL_USERS_JSON in Vercel for the first deployment only. Delete that environment variable after the accounts have been created.')
