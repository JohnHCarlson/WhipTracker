import fs from 'node:fs'
import path from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { z } from 'zod'
import * as accounts from './accounts.ts'
import { endSession, recheckSoon, rememberNames, requirePeopleAdmin, requireUser, session, signIn, signInChecked, type Env } from './auth.ts'
import { APP_ID, PRODUCTION } from './config.ts'
import { broadcast, disconnect, disconnectVote, openStream } from './events.ts'
import { HttpError } from './http.ts'
import { addPersonBody, createVoteBody, loginBody, passwordBody, positionsBody, settingsBody, shareBody, updatePersonBody } from './validate.ts'
import { canSee, createVote, deleteVote, getVote, listVotes, removeShare, setPositions, setShare, updateSettings } from './votes.ts'

/*
 * The API under /api, and in production the built pages too. Everything but
 * signing in needs a session. What someone can do with a vote is checked in
 * votes.ts; managing people is checked by the accounts service.
 */

export const app = new Hono<Env>()

const STATIC_ROOT = path.resolve(process.env.WHIP_STATIC ?? path.join(import.meta.dirname, '../dist'))
/**
 * Which build of the pages this server sends: the main script's file name,
 * which changes with every build. Open pages compare it with their own and
 * offer a reload after a deploy. None in development, where Vite serves them.
 */
const BUILD = PRODUCTION ? (/src="(\/assets\/index-[^"]+\.js)"/.exec(fs.readFileSync(path.join(STATIC_ROOT, 'index.html'), 'utf8'))?.[1] ?? null) : null

app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // React sets inline styles (the tally bar's widths).
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  }),
)
// Keep search engines out; the site is private.
app.use('*', async (c, next) => {
  await next()
  c.header('X-Robots-Tag', 'noindex, nofollow')
})

// Invite links are passwords until used, so they stay out of the log.
app.use('/api/*', logger((line, ...rest) => console.log(line.replace(/\/invite\/[\w-]+/, '/invite/…'), ...rest)))
app.use('/api/*', bodyLimit({ maxSize: 1024 * 1024, onError: (c) => c.json({ error: 'That’s too much to send at once.' }, 413) }))

// Changes only come from this site's own pages: they send JSON, from this origin.
app.use('/api/*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin')
    if (origin && new URL(origin).host !== c.req.header('host')) throw new HttpError(403, 'Requests from other sites aren’t allowed.')
    if (!c.req.header('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Send JSON.')
  }
  await next()
})

/** The request body, checked against a schema. */
async function body<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Something in that request isn’t right.')
  return parsed.data
}

function numberParam(c: Context, name: string) {
  const n = Number(c.req.param(name))
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, 'Not found.')
  return n
}

// ------------------------------------------------------------------ signing in (no session needed)

app.get('/api/health', (c) => c.json({ ok: true }))

app.post('/api/login', async (c) => {
  const { email, password } = await body(c, loginBody)
  return c.json({ user: await signIn(c, email, password) })
})

app.post('/api/logout', (c) => {
  endSession(c)
  return c.json({ ok: true })
})

app.get('/api/invite/:token', async (c) => c.json(await accounts.getInvite(c.req.param('token'))))

app.post('/api/invite/:token', async (c) => {
  const { password } = await body(c, passwordBody)
  const checked = await accounts.acceptInvite(c.req.param('token'), password)
  // The new password signs them out everywhere else.
  disconnect(checked.user.id)
  return c.json({ user: signInChecked(c, checked) })
})

app.use('/api/*', session)
app.get('/api/me', (c) => c.json({ user: c.get('user') }))

// ------------------------------------------------------------------ votes

app.get('/api/votes', requireUser, (c) => c.json(listVotes(c.get('user'))))
app.post('/api/votes', requireUser, async (c) => c.json(createVote(c.get('user'), await body(c, createVoteBody))))
app.get('/api/votes/:id', requireUser, (c) => c.json(getVote(c.get('user'), c.req.param('id'))))

app.patch('/api/votes/:id', requireUser, async (c) => {
  const { settings, requestId } = await body(c, settingsBody)
  const change = updateSettings(c.get('user'), c.req.param('id'), settings, requestId)
  broadcast(change.voteId, 'change', change)
  return c.json(change)
})

app.patch('/api/votes/:id/positions', requireUser, async (c) => {
  const { changes, requestId } = await body(c, positionsBody)
  const change = setPositions(c.get('user'), c.req.param('id'), changes, requestId)
  broadcast(change.voteId, 'change', change)
  return c.json(change)
})

app.delete('/api/votes/:id', requireUser, (c) => {
  const id = c.req.param('id')
  deleteVote(c.get('user'), id)
  broadcast(id, 'deleted', { by: c.get('user').name })
  disconnectVote(id)
  return c.json({ ok: true })
})

app.put('/api/votes/:id/shares/:person', requireUser, async (c) => {
  const id = c.req.param('id')
  const personId = numberParam(c, 'person')
  const { permission } = await body(c, shareBody)
  if (!(await directory()).some((m) => m.id === personId)) throw new HttpError(400, 'They can’t use the Whip Tracker. An admin can add them on the People page.')
  setShare(c.get('user'), id, personId, permission)
  broadcast(id, 'access', {})
  return c.json(getVote(c.get('user'), id))
})

app.delete('/api/votes/:id/shares/:person', requireUser, (c) => {
  const id = c.req.param('id')
  const personId = numberParam(c, 'person')
  removeShare(c.get('user'), id, personId)
  broadcast(id, 'access', {})
  disconnect(personId, id)
  return c.json(personId === c.get('user').id ? { ok: true } : getVote(c.get('user'), id))
})

app.get('/api/events/:id', requireUser, (c) => {
  const id = c.req.param('id')
  if (!canSee(c.get('user'), id)) throw new HttpError(404, 'That vote isn’t here, or it isn’t shared with you.')
  return openStream(c, c.get('user').id, id, BUILD)
})

/*
 * Everyone who can use the app, for choosing who to share with. Asked of the
 * accounts service at most every 30 seconds.
 */
let members: { at: number; list: Promise<accounts.Member[]> } | null = null
function directory() {
  if (!members || Date.now() - members.at > 30_000) {
    const list = accounts.members().then((l) => {
      rememberNames(l)
      return l
    })
    members = { at: Date.now(), list }
    list.catch(() => (members = null))
  }
  return members.list
}

app.get('/api/directory', requireUser, async (c) => c.json((await directory()).map(({ id, name, email }) => ({ id, name, email }))))

// ------------------------------------------------------------------ people (admins, and the owner)

/** After changing someone: their next request re-checks, and if they lost this app, their open pages close. */
function changed(person: accounts.Person | null, id: number) {
  recheckSoon(id)
  members = null
  if (!person?.access[APP_ID]) disconnect(id)
}

app.get('/api/people', requirePeopleAdmin, async (c) => c.json(await accounts.listPeople(c.get('user').id)))

app.post('/api/people', requirePeopleAdmin, async (c) => {
  const result = await accounts.addPerson(c.get('user').id, await body(c, addPersonBody))
  changed(result.person, result.person.id)
  return c.json(result)
})

app.patch('/api/people/:id', requirePeopleAdmin, async (c) => {
  const id = numberParam(c, 'id')
  const result = await accounts.updatePerson(c.get('user').id, id, await body(c, updatePersonBody))
  changed(result.person, id)
  return c.json(result)
})

app.post('/api/people/:id/invite', requirePeopleAdmin, async (c) => c.json(await accounts.newInvite(c.get('user').id, numberParam(c, 'id'))))

app.delete('/api/people/:id', requirePeopleAdmin, async (c) => {
  const id = numberParam(c, 'id')
  await accounts.deletePerson(c.get('user').id, id)
  changed(null, id)
  return c.json({ ok: true })
})

app.all('/api/*', (c) => c.json({ error: 'Not found.' }, 404))

// ------------------------------------------------------------------ pages

if (PRODUCTION) {
  const root = STATIC_ROOT
  // File names under /assets change with every build, so browsers can keep them. Member photos
  // change rarely. Everything else is checked each time.
  app.use('*', async (c, next) => {
    await next()
    if (c.res.headers.has('Cache-Control')) return
    if (c.req.path.startsWith('/assets/')) c.header('Cache-Control', 'public, max-age=31536000, immutable')
    else if (c.req.path.startsWith('/members/')) c.header('Cache-Control', 'public, max-age=604800')
    else c.header('Cache-Control', 'no-cache')
  })
  app.use('*', serveStatic({ root }))
  // Every other address is a page of the app (/v/…, /invite/…), which the app routes itself. A missing file is just missing.
  app.get('*', (c, next) => (/\.\w+$/.test(c.req.path) ? c.notFound() : next()), serveStatic({ root, path: 'index.html' }))
}

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status)
  if (err instanceof accounts.AccountsDown) return c.json({ error: 'Signing in isn’t working right now. Try again in a minute.' }, 503)
  console.error(err)
  return c.json({ error: 'Something went wrong on the server.' }, 500)
})
