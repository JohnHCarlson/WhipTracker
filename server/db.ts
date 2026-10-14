import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite'
import { BACKUP_DIR, DATA_DIR } from './config.ts'

/*
 * The app's database: one SQLite file. A vote is one row, with its settings
 * and positions stored as JSON; who it's shared with has its own table.
 * People are referred to by their id in the accounts service, which keeps
 * passwords and access; this file keeps sign-in sessions and what the
 * service last said about each person. Node's built-in SQLite means nothing
 * has to be compiled on the server.
 */

export const DB_PATH = path.join(DATA_DIR, 'votes.db')

fs.mkdirSync(DATA_DIR, { recursive: true })
export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;')

/** Copies of the database in data/backups (see backup.ts for when). The newest 300 are kept. */
const KEEP_BACKUPS = 300

export function snapshot(reason: string) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  // Two copies in the same second get "-2", "-3", ... so neither is lost.
  let file = path.join(BACKUP_DIR, `votes-${stamp}-${reason}.db`)
  for (let n = 2; fs.existsSync(file); n++) file = path.join(BACKUP_DIR, `votes-${stamp}-${reason}-${n}.db`)
  // VACUUM INTO writes a consistent copy even while the server is running.
  db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`)
  const old = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('votes-') && f.endsWith('.db'))
    .sort()
    .slice(0, -KEEP_BACKUPS)
  for (const f of old) fs.rmSync(path.join(BACKUP_DIR, f))
  return file
}

/** Each entry runs once, in order; `PRAGMA user_version` counts how many have run. Never edit one that has shipped. */
const MIGRATIONS: (() => void)[] = [
  () =>
    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE votes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        -- Vote type, delegates, candidate names and positions: see VoteData in votes.ts.
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by INTEGER NOT NULL,
        -- Up by one with every change, so a page can tell whether it missed one.
        version INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX votes_owner ON votes (owner_id);
      CREATE TABLE shares (
        vote_id TEXT NOT NULL REFERENCES votes (id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL,
        permission TEXT NOT NULL CHECK (permission IN ('edit', 'view')),
        added_at TEXT NOT NULL,
        PRIMARY KEY (vote_id, person_id)
      );
      CREATE INDEX shares_person ON shares (person_id);
      -- Signed-in browsers. Only a hash of each cookie's token is kept.
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        expires TEXT NOT NULL
      );
      CREATE INDEX sessions_user ON sessions (user_id);
      -- What the accounts service last said about each person: their role here
      -- (null once they lose access), re-checked at most once a minute, and their
      -- name, kept for showing who made or changed a vote.
      CREATE TABLE people (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT,
        owner INTEGER NOT NULL DEFAULT 0,
        sessions_valid_after TEXT NOT NULL,
        checked_at TEXT NOT NULL
      );
    `),
]

const applied = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
// An existing database is copied before it's changed.
if (applied > 0 && applied < MIGRATIONS.length) console.log(`Backed up before updating the database: ${snapshot('before-migration')}`)
for (let i = applied; i < MIGRATIONS.length; i++) {
  tx(() => {
    MIGRATIONS[i]()
    db.exec(`PRAGMA user_version = ${i + 1}`)
  })
}

const statements = new Map<string, StatementSync>()
/** A prepared statement, reused across calls. */
export function q(sql: string) {
  let s = statements.get(sql)
  if (!s) statements.set(sql, (s = db.prepare(sql)))
  return s
}

export const one = <T>(sql: string, ...params: SQLInputValue[]) => q(sql).get(...params) as T | undefined
export const all = <T>(sql: string, ...params: SQLInputValue[]) => q(sql).all(...params) as T[]
export const run = (sql: string, ...params: SQLInputValue[]) => q(sql).run(...params)

/** Runs `fn` as one transaction: everything in it is saved, or nothing is. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

/** Counts every saved change, so backups can tell whether anything happened since the last one. */
export const changeCount = () => Number(one<{ value: string }>("SELECT value FROM meta WHERE key = 'changes'")?.value ?? 0)
export function countChange() {
  run("INSERT INTO meta (key, value) VALUES ('changes', '1') ON CONFLICT (key) DO UPDATE SET value = CAST(value AS INTEGER) + 1")
}
