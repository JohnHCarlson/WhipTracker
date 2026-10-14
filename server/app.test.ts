import assert from 'node:assert/strict'
import fs from 'node:fs'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { serve, type ServerType } from '@hono/node-server'
import { Hono } from 'hono'

/*
 * The API, end to end, against a stand-in for the accounts service that
 * knows four people. Run with `npm test`.
 */

interface FakeUser {
  id: number
  email: string
  name: string
  owner: boolean
  sessionsValidAfter: string
  role: string | null
  password: string
}
const T0 = new Date(Date.now() - 60_000).toISOString()
const people: FakeUser[] = [
  { id: 1, email: 'olive@example.com', name: 'Olive Owner', owner: true, sessionsValidAfter: T0, role: 'admin', password: 'olive password' },
  { id: 2, email: 'alice@example.com', name: 'Alice Member', owner: false, sessionsValidAfter: T0, role: 'member', password: 'alice password' },
  { id: 3, email: 'bob@example.com', name: 'Bob Member', owner: false, sessionsValidAfter: T0, role: 'member', password: 'bob password' },
  { id: 4, email: 'eve@example.com', name: 'Eve Elsewhere', owner: false, sessionsValidAfter: T0, role: null, password: 'eve password' },
]
const checked = (u: FakeUser) => ({ user: { id: u.id, email: u.email, name: u.name, owner: u.owner, sessionsValidAfter: u.sessionsValidAfter }, role: u.role })

const fake = new Hono()
fake.use('/v1/*', async (c, next) => {
  if (c.req.header('authorization') !== 'Bearer test-key') return c.json({ error: 'Unknown app key.' }, 401, { 'WWW-Authenticate': 'Bearer' })
  await next()
})
fake.post('/v1/verify', async (c) => {
  const { email, password } = await c.req.json()
  const u = people.find((p) => p.email === email.toLowerCase())
  if (!u || u.password !== password) return c.json({ error: 'That email and password don’t match.' }, 401)
  if (!u.role) return c.json({ error: 'Your account isn’t set up for Whip Tracker. Ask an admin to add you.' }, 403)
  return c.json(checked(u))
})
fake.get('/v1/users/:id', (c) => {
  const u = people.find((p) => p.id === Number(c.req.param('id')))
  return u ? c.json(checked(u)) : c.json({ error: 'That account isn’t there anymore.' }, 404)
})
fake.get('/v1/members', (c) => c.json(people.filter((p) => p.role).map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.role }))))

let server: ServerType
let port = 0
let api: typeof import('./app.ts').app
let db: typeof import('./db.ts')

before(async () => {
  server = serve({ fetch: fake.fetch, port: 0, hostname: '127.0.0.1' })
  await new Promise((resolve) => server.once('listening', resolve))
  port = (server.address() as AddressInfo).port
  // A fresh database in a temporary folder, set before the server code loads.
  process.env.WHIP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'whip-test-'))
  process.env.ACCOUNTS_URL = `http://127.0.0.1:${port}`
  process.env.ACCOUNTS_KEY = 'test-key'
  api = (await import('./app.ts')).app
  db = await import('./db.ts')
})
after(() => server.close())

/** Signs in and returns a function that makes requests as that person. */
async function as(email: string, password: string) {
  const res = await api.request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  assert.equal(res.status, 200, await res.clone().text())
  const cookie = /session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')![1]
  // Like the pages, every change sends JSON, even an empty object.
  return async (method: string, url: string, body?: unknown) => {
    const get = method === 'GET'
    const r = await api.request(url, {
      method,
      headers: { Cookie: `session=${cookie}`, ...(get ? {} : { 'Content-Type': 'application/json' }) },
      body: get ? undefined : JSON.stringify(body ?? {}),
    })
    // Untyped: the tests check the shape themselves.
    return { status: r.status, data: (await r.json().catch(() => null)) as any }
  }
}

let olive: Awaited<ReturnType<typeof as>>
let alice: Awaited<ReturnType<typeof as>>
let bob: Awaited<ReturnType<typeof as>>
let voteId = ''

describe('signing in', () => {
  test('people with access get in; a wrong password and no access say why', async () => {
    olive = await as('olive@example.com', 'olive password')
    alice = await as('alice@example.com', 'alice password')
    bob = await as('bob@example.com', 'bob password')
    const me = await alice('GET', '/api/me')
    assert.deepEqual(me.data.user, { id: 2, email: 'alice@example.com', name: 'Alice Member', role: 'member', owner: false })

    const post = (body: unknown) => api.request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    assert.equal((await post({ email: 'alice@example.com', password: 'nope' })).status, 401)
    const eve = await post({ email: 'eve@example.com', password: 'eve password' })
    assert.equal(eve.status, 403)
  })

  test('nothing without a session', async () => {
    assert.equal((await api.request('/api/votes')).status, 401)
  })
})

describe('votes and sharing', () => {
  test('making a vote and setting positions', async () => {
    const made = await alice('POST', '/api/votes', { title: 'HR 1' })
    assert.equal(made.status, 200)
    assert.equal(made.data.access, 'owner')
    assert.equal(made.data.ownerName, 'Alice Member')
    voteId = made.data.id

    const change = await alice('PATCH', `/api/votes/${voteId}/positions`, { changes: { A000370: 'yes', B001230: 'no' }, requestId: 'r1' })
    assert.equal(change.status, 200)
    assert.equal(change.data.version, 2)
    assert.equal(change.data.requestId, 'r1')
    await alice('PATCH', `/api/votes/${voteId}/positions`, { changes: { B001230: null } })
    const settings = await alice('PATCH', `/api/votes/${voteId}`, { settings: { voteType: 'speaker', candidates: { speaker: ['Jeffries', 'Johnson'] } } })
    assert.equal(settings.status, 200)

    const vote = (await alice('GET', `/api/votes/${voteId}`)).data
    assert.deepEqual(vote.positions, { A000370: 'yes' })
    assert.equal(vote.voteType, 'speaker')
    assert.deepEqual(vote.candidates, { speaker: ['Jeffries', 'Johnson'] })
    assert.equal(vote.version, 4)
  })

  test('bad input is turned away', async () => {
    assert.equal((await alice('PATCH', `/api/votes/${voteId}/positions`, { changes: { nobody: 'yes' } })).status, 400)
    assert.equal((await alice('PATCH', `/api/votes/${voteId}/positions`, { changes: { A000370: 'maybe' } })).status, 400)
    assert.equal((await alice('PATCH', `/api/votes/${voteId}`, { settings: { voteType: 'made-up' } })).status, 400)
    assert.equal((await alice('POST', '/api/votes', { title: '  ' })).status, 400)
  })

  test('someone it isn’t shared with can’t see it; an admin can', async () => {
    assert.equal((await bob('GET', `/api/votes/${voteId}`)).status, 404)
    assert.equal((await bob('GET', '/api/votes')).data.length, 0)
    const asAdmin = await olive('GET', `/api/votes/${voteId}`)
    assert.equal(asAdmin.data.access, 'admin')
    assert.equal((await olive('PATCH', `/api/votes/${voteId}/positions`, { changes: { A000371: 'present' } })).status, 200)
  })

  test('view-only sharing lets them look but not change', async () => {
    const shared = await alice('PUT', `/api/votes/${voteId}/shares/3`, { permission: 'view' })
    assert.equal(shared.status, 200)
    assert.deepEqual(shared.data.shares, [{ personId: 3, name: 'Bob Member', permission: 'view' }])
    const seen = await bob('GET', `/api/votes/${voteId}`)
    assert.equal(seen.data.access, 'view')
    assert.equal((await bob('PATCH', `/api/votes/${voteId}/positions`, { changes: { A000370: 'no' } })).status, 403)
    assert.equal((await bob('GET', '/api/votes')).data.length, 1)
  })

  test('edit sharing lets them change positions, but not share or delete', async () => {
    await alice('PUT', `/api/votes/${voteId}/shares/3`, { permission: 'edit' })
    assert.equal((await bob('PATCH', `/api/votes/${voteId}/positions`, { changes: { A000370: 'no' } })).status, 200)
    assert.equal((await bob('PUT', `/api/votes/${voteId}/shares/1`, { permission: 'view' })).status, 403)
    assert.equal((await bob('DELETE', `/api/votes/${voteId}`)).status, 403)
    const vote = (await alice('GET', `/api/votes/${voteId}`)).data
    assert.equal(vote.updatedBy.name, 'Bob Member')
  })

  test('only people who can use the app can be shared with', async () => {
    assert.equal((await alice('PUT', `/api/votes/${voteId}/shares/4`, { permission: 'view' })).status, 400)
  })

  test('people can take themselves off a shared vote', async () => {
    assert.equal((await bob('DELETE', `/api/votes/${voteId}/shares/3`)).status, 200)
    assert.equal((await bob('GET', `/api/votes/${voteId}`)).status, 404)
  })

  test('duplicating copies the positions into a new vote the copier owns', async () => {
    const copy = await olive('POST', '/api/votes', { title: 'HR 1 (copy)', copyFrom: voteId })
    assert.equal(copy.data.access, 'owner')
    assert.equal(copy.data.positions.A000370, 'no')
    assert.notEqual(copy.data.id, voteId)
  })

  test('the owner can delete it', async () => {
    assert.equal((await alice('DELETE', `/api/votes/${voteId}`)).status, 200)
    assert.equal((await olive('GET', `/api/votes/${voteId}`)).status, 404)
  })
})

describe('re-checking with the accounts service', () => {
  const stale = (id: number) => db.run("UPDATE people SET checked_at = '2000-01-01T00:00:00.000Z' WHERE id = ?", id)

  test('a role change shows up at the next check', async () => {
    people[2].role = 'admin'
    stale(3)
    assert.equal((await bob('GET', '/api/me')).data.user.role, 'admin')
    people[2].role = 'member'
    stale(3)
  })

  test('someone removed from the app is signed out', async () => {
    people[2].role = null
    stale(3)
    assert.equal((await bob('GET', '/api/votes')).status, 401)
    people[2].role = 'member'
    // Their sessions are gone, not just paused.
    stale(3)
    assert.equal((await bob('GET', '/api/votes')).status, 401)
    bob = await as('bob@example.com', 'bob password')
  })

  test('a new password ends sessions that started before it', async () => {
    people[1].sessionsValidAfter = new Date(Date.now() + 1000).toISOString()
    stale(2)
    assert.equal((await alice('GET', '/api/me')).data.user, null)
    people[1].sessionsValidAfter = T0
  })

  test('if the service is down, a recent check still counts; an old one doesn’t', async () => {
    server.close()
    ;(server as import('node:http').Server).closeAllConnections()
    // Checked two minutes ago: past due for a check, but the last answer still holds.
    db.run('UPDATE people SET checked_at = ? WHERE id = 1', new Date(Date.now() - 120_000).toISOString())
    assert.equal((await olive('GET', '/api/me')).data.user?.name, 'Olive Owner')
    stale(1)
    const res = await olive('GET', '/api/me')
    assert.equal(res.status, 503)
  })
})
