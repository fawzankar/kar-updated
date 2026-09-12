import { randomBytes } from 'node:crypto'

const count = Math.max(1, Math.min(50, Number(process.argv[2] || 13)))
const accounts = Array.from({ length: count }, (_, index) => {
  const number = String(index + 1).padStart(2, '0')
  return {
    username: `user${number}`,
    displayName: `User ${number}`,
    password: randomBytes(12).toString('base64url'),
  }
})

console.log(JSON.stringify(accounts))
console.error('\nCopy the JSON above to INITIAL_USERS_JSON in Vercel for the first deployment only. Delete that environment variable after the accounts have been created.')
