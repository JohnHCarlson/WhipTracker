import { ACCOUNTS_KEY, ACCOUNTS_URL } from './config.ts'
import { HttpError } from './http.ts'

/*
 * Talks to the accounts service (D:\Dev\Accounts), which keeps everyone's
 * email, password and access to each jcvc.io app. It runs on the same
 * machine, on 127.0.0.1:3100, and knows this app by its key.
 */

export interface AccountUser {
  id: number
  email: string
  name: string
  owner: boolean
  sessionsValidAfter: string
}

/** A person and their role here, or null if they can't use this app. */
export interface Checked {
  user: AccountUser
  role: string | null
}

export interface Member {
  id: number
  name: string
  email: string
  role: string
}

/** The accounts service didn't answer, or turned down this app's key. Not the visitor's doing. */
export class AccountsDown extends Error {}

type Status = ConstructorParameters<typeof HttpError>[0]
const PASSED_ON = new Set([400, 401, 403, 404, 409, 429])

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${ACCOUNTS_URL}/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${ACCOUNTS_KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    })
  } catch (e) {
    console.error(`The accounts service didn't answer ${method} ${path.replace(/invites\/[\w-]+/, 'invites/…')}:`, (e as Error).message)
    throw new AccountsDown()
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (res.ok) return data as T
  // A 401 with this header is about this app's key (its settings are wrong), not someone's password.
  if (PASSED_ON.has(res.status) && !res.headers.has('www-authenticate')) throw new HttpError(res.status as Status, data?.error ?? 'The accounts service turned that down.')
  console.error(`The accounts service answered ${res.status} to ${method} ${path.replace(/invites\/[\w-]+/, 'invites/…')}: ${data?.error}`)
  throw new AccountsDown()
}

export const verify = (email: string, password: string, ip: string) => call<Checked>('POST', '/verify', { email, password, ip })
export const getUser = (id: number) => call<Checked>('GET', `/users/${id}`)
export const getInvite = (token: string) => call<{ name: string; email: string; hasPassword: boolean }>('GET', `/invites/${encodeURIComponent(token)}`)
export const acceptInvite = (token: string, password: string) => call<Checked>('POST', `/invites/${encodeURIComponent(token)}`, { password })
export const members = () => call<Member[]>('GET', '/members')

// People pages: the service checks what the signed-in person (`actor`) may do.
export interface PersonAccess {
  role: string
  lastSeen: string | null
}
export interface Person {
  id: number
  email: string
  name: string
  owner: boolean
  status: 'active' | 'invited' | 'expired'
  inviteExpires: string | null
  access: Record<string, PersonAccess>
}
export interface ManagedApp {
  id: string
  name: string
  roles: string[]
  url: string
}
export interface Invite {
  token: string
  expires: string
}

export const listPeople = (actor: number) => call<{ apps: ManagedApp[]; owner: boolean; people: Person[] }>('GET', `/people?actor=${actor}`)
export const addPerson = (actor: number, p: { email: string; name: string; access: Record<string, string> }) =>
  call<{ person: Person; invite: Invite | null; existed: boolean }>('POST', '/people', { actor, ...p })
export const updatePerson = (actor: number, id: number, changes: { name?: string; access?: Record<string, string | null> }) =>
  call<{ person: Person }>('PATCH', `/people/${id}`, { actor, ...changes })
export const newInvite = (actor: number, id: number) => call<{ person: Person; invite: Invite }>('POST', `/people/${id}/invite`, { actor })
export const deletePerson = (actor: number, id: number) => call<{ ok: true }>('DELETE', `/people/${id}`, { actor })
