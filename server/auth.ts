import crypto from 'node:crypto'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { ROLES } from '../src/lib/access.js'
import { AccountsDown, getUser, verify, type Checked } from './accounts.ts'
import { PRODUCTION } from './config.ts'
import { all, one, run } from './db.ts'
import { HttpError } from './http.ts'

/*
 * Signing in. The accounts service checks passwords and says who can use
 * this app; the sessions are this app's own. A session is a random token in
 * an HttpOnly cookie for this host only, stored here as a hash, lasting 30
 * days from the last visit.
 *
 * Each signed-in person is re-checked with the service at most once a minute,
 * so someone removed, or with a new role, finds out within a minute. If the
 * service is down, people already signed in keep their last known role for
 * ten minutes.
 */

export type Role = (typeof ROLES)[number]
export interface User {
  id: number
  email: string
  name: string
  role: Role
  owner: boolean
}

const DAY = 86_400_000
const SESSION_DAYS = 30
const RECHECK = 60_000
const GRACE = 10 * 60_000
// In production the cookie only travels over HTTPS and only to this exact host (__Host-session).
const COOKIE_PREFIX = PRODUCTION ? 'host' : undefined
const COOKIE = 'session'

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('base64url')
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString()
const isRole = (role: string | null): role is Role => role != null && (ROLES as readonly string[]).includes(role)

interface PersonRow {
  id: number
  email: string
  name: string
  role: string | null
  owner: number
  sessions_valid_after: string
  checked_at: string
}

// ------------------------------------------------------------------ what the service said

/** Saves what the accounts service said about someone. */
export function remember({ user, role }: Checked) {
  run(
    `INSERT INTO people (id, email, name, role, owner, sessions_valid_after, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET email = excluded.email, name = excluded.name, role = excluded.role, owner = excluded.owner,
       sessions_valid_after = excluded.sessions_valid_after, checked_at = excluded.checked_at`,
    user.id,
    user.email,
    user.name,
    role,
    user.owner ? 1 : 0,
    user.sessionsValidAfter,
    new Date().toISOString(),
  )
}

/** Keeps names current for people seen in a list, without counting as a re-check. */
export function rememberNames(list: { id: number; name: string; email: string }[]) {
  for (const p of list)
    run(
      `INSERT INTO people (id, email, name, sessions_valid_after, checked_at) VALUES (?, ?, ?, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.000Z')
       ON CONFLICT (id) DO UPDATE SET email = excluded.email, name = excluded.name`,
      p.id,
      p.email,
      p.name,
    )
}

/** Makes the next request from this person check with the service (after an admin changed them). */
export function recheckSoon(id: number) {
  run("UPDATE people SET checked_at = '1970-01-01T00:00:00.000Z' WHERE id = ?", id)
}

/** Everyone this app has heard of, by id: for showing who made or changed something. */
export const names = () => new Map(all<{ id: number; name: string }>('SELECT id, name FROM people').map((p) => [p.id, p.name]))

const checking = new Map<number, Promise<PersonRow | undefined>>()

/** The person as the service last described them, re-checked if that was over a minute ago. */
async function freshPerson(id: number): Promise<PersonRow | undefined> {
  const cached = one<PersonRow>('SELECT * FROM people WHERE id = ?', id)
  const age = cached ? Date.now() - Date.parse(cached.checked_at) : Infinity
  if (age < RECHECK) return cached
  // Many requests at once (a page loading) share one check.
  let pending = checking.get(id)
  if (!pending) {
    pending = getUser(id)
      .then(
        (checked) => remember(checked),
        (e) => {
          // The account is gone: no role here anymore.
          if (e instanceof HttpError && e.status === 404) run('UPDATE people SET role = NULL, checked_at = ? WHERE id = ?', new Date().toISOString(), id)
          else throw e
        },
      )
      .then(() => one<PersonRow>('SELECT * FROM people WHERE id = ?', id))
      .finally(() => checking.delete(id))
    checking.set(id, pending)
  }
  try {
    return await pending
  } catch (e) {
    if (!(e instanceof AccountsDown)) throw e
    if (cached && age < GRACE) return cached
    throw new HttpError(503, 'Can’t check your account right now. Try again in a minute.')
  }
}

// ------------------------------------------------------------------ sessions

function setSessionCookie(c: Context, t: string) {
  setCookie(c, COOKIE, t, { prefix: COOKIE_PREFIX, path: '/', httpOnly: true, secure: PRODUCTION, sameSite: 'Lax', maxAge: SESSION_DAYS * 86_400 })
}

export function startSession(c: Context, userId: number) {
  const t = crypto.randomBytes(32).toString('base64url')
  run('INSERT INTO sessions (token_hash, user_id, created_at, expires) VALUES (?, ?, ?, ?)', sha256(t), userId, new Date().toISOString(), inDays(SESSION_DAYS))
  setSessionCookie(c, t)
}

export function endSession(c: Context) {
  const t = getCookie(c, COOKIE, COOKIE_PREFIX)
  if (t) run('DELETE FROM sessions WHERE token_hash = ?', sha256(t))
  deleteCookie(c, COOKIE, { prefix: COOKIE_PREFIX, path: '/', secure: PRODUCTION })
}

/** The signed-in person, if any. */
async function sessionUser(c: Context): Promise<User | null> {
  const t = getCookie(c, COOKIE, COOKIE_PREFIX)
  if (!t) return null
  const hash = sha256(t)
  const session = one<{ user_id: number; created_at: string; expires: string }>('SELECT user_id, created_at, expires FROM sessions WHERE token_hash = ?', hash)
  if (!session || session.expires <= new Date().toISOString()) {
    if (session) run('DELETE FROM sessions WHERE token_hash = ?', hash)
    return null
  }
  const person = await freshPerson(session.user_id)
  // Removed from this app, or the account is gone: every session of theirs ends.
  if (!person || !isRole(person.role)) {
    run('DELETE FROM sessions WHERE user_id = ?', session.user_id)
    return null
  }
  // Started before their password last changed.
  if (session.created_at < person.sessions_valid_after) {
    run('DELETE FROM sessions WHERE token_hash = ?', hash)
    return null
  }
  // Writes at most once a day per session.
  if (Date.parse(session.expires) - Date.now() < (SESSION_DAYS - 1) * DAY) {
    run('UPDATE sessions SET expires = ? WHERE token_hash = ?', inDays(SESSION_DAYS), hash)
    setSessionCookie(c, t)
  }
  return { id: person.id, email: person.email, name: person.name, role: person.role, owner: person.owner === 1 }
}

export type Env = { Variables: { user: User | null } }

/** Looks up who's signed in, for every API request after signing in. */
export const session = createMiddleware<Env>(async (c, next) => {
  c.set('user', await sessionUser(c))
  await next()
})

const requireRole = (allowed: (u: User) => boolean) =>
  createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
    const user = c.get('user')
    if (!user) throw new HttpError(401, 'Your session has ended. Sign in again.')
    if (!allowed(user)) throw new HttpError(403, 'Your account can’t do that. Ask an admin if you need it.')
    await next()
  })

export const requireUser = requireRole(() => true)
/** People pages: this app's admins, and the owner. The service makes the finer checks. */
export const requirePeopleAdmin = requireRole((u) => u.role === 'admin' || u.owner)

// ------------------------------------------------------------------ signing in

/** The visitor's address, for the service's limit on wrong passwords. In production Caddy is in front and passes it along. */
function clientIp(c: Context) {
  if (PRODUCTION) return c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown' // Requests made in tests have no connection.
  }
}

function toUser(checked: Checked): User {
  if (!isRole(checked.role)) throw new HttpError(403, 'Your account isn’t set up for the Whip Tracker. Ask an admin to add you.')
  const { id, email, name, owner } = checked.user
  return { id, email, name, owner, role: checked.role }
}

export async function signIn(c: Context, email: string, password: string): Promise<User> {
  const checked = await verify(email, password, clientIp(c))
  remember(checked)
  const user = toUser(checked)
  startSession(c, user.id)
  return user
}

/** After a password is set from a link: signs in here, if this account can use the app. */
export function signInChecked(c: Context, checked: Checked): User {
  remember(checked)
  const user = toUser(checked)
  startSession(c, user.id)
  return user
}
