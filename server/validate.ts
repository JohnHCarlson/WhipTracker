import { z } from 'zod'
import { MIN_PASSWORD, TITLE_MAX } from '../src/lib/access.js'
import { VOTE_TYPES } from '../src/lib/voteTypes.js'

/*
 * The shape of everything the pages send. Anything else is turned away
 * before it reaches the database.
 */

const position = z.enum(['yes', 'no', 'other', 'present'])
/** A Bioguide id: "A000370". */
const memberId = z.string().regex(/^[A-Z]\d{6}$/)
const voteType = z.enum(VOTE_TYPES.map((t: { id: string }) => t.id) as [string, ...string[]])
const title = z.string().trim().min(1, 'Give it a name.').max(TITLE_MAX, `Keep the name under ${TITLE_MAX} characters.`)
const candidates = z.partialRecord(voteType, z.array(z.string().max(24)).max(3))
/** The page's own id for a change, echoed back so it can recognize it. */
const requestId = z.string().max(64).nullable().default(null)
// The House has 441 members and delegates; anything far past that isn't a real request.
const fewerThan = (n: number) => (r: Record<string, unknown>) => Object.keys(r).length < n

export const voteData = z.object({
  voteType,
  delegatesVote: z.boolean(),
  candidates,
  positions: z.record(memberId, position).refine(fewerThan(600)),
})

export const createVoteBody = z.object({ title, copyFrom: z.string().max(32).optional(), data: voteData.optional() })
export const settingsBody = z.object({
  settings: z.object({ title, voteType, delegatesVote: z.boolean(), candidates }).partial().strict(),
  requestId,
})
export const positionsBody = z.object({
  changes: z.record(memberId, position.nullable()).refine(fewerThan(600)),
  requestId,
})
export const shareBody = z.object({ permission: z.enum(['edit', 'view']) })

const email = z.string().trim().toLowerCase().pipe(z.email('That doesn’t look like an email address.')).pipe(z.string().max(200))
const name = z.string().trim().min(1, 'Add their name.').max(100)
const appId = z.string().max(50)
const role = z.string().max(50)

export const loginBody = z.object({ email: z.string().trim().max(200), password: z.string().max(500) })
export const passwordBody = z.object({
  password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`).max(500, 'That password is too long.'),
})
export const addPersonBody = z.object({ email, name, access: z.record(appId, role) })
export const updatePersonBody = z.object({ name: name.optional(), access: z.record(appId, role.nullable()).optional() }).strict()
