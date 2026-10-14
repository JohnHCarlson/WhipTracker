// Starts the accounts service from its own project (D:\Dev\Accounts, or ACCOUNTS_DIR) for
// `npm run dev`, unless it's already running.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const dir = process.env.ACCOUNTS_DIR ?? 'D:/Dev/Accounts'

const running = await fetch('http://127.0.0.1:3100/health').then(
  (res) => res.ok,
  () => false,
)
if (running) {
  console.log('The accounts service is already running on port 3100.')
} else if (!existsSync(dir)) {
  console.error(`No accounts service at ${dir}. Set ACCOUNTS_DIR to its folder; nobody can sign in without it.`)
} else {
  spawn('npm run dev', { cwd: dir, stdio: 'inherit', shell: true })
}
