import { changeCount, snapshot } from './db.ts'

/*
 * A copy of the database every five minutes while anything is changing.
 * Deleting a vote takes its own copy first (votes.ts), and so does a
 * database update at startup (db.ts). Accounts are backed up by the
 * accounts service.
 */
export function startBackups() {
  let saved = changeCount()
  setInterval(() => {
    const count = changeCount()
    if (count === saved) return
    try {
      snapshot('auto')
      saved = count
    } catch (e) {
      console.error('Backup failed:', e)
    }
  }, 5 * 60_000).unref()
}
