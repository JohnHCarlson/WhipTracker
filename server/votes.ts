import crypto from 'node:crypto'
import { DEFAULT_VOTE_TYPE_ID } from '../src/lib/voteTypes.js'
import { names, type User } from './auth.ts'
import { all, countChange, one, run, snapshot, tx } from './db.ts'
import { HttpError } from './http.ts'

/*
 * Saved votes. Whoever makes a vote owns it and can share it with other
 * people here, who can edit it or only view it. Admins see and can do
 * everything with every vote. The pages use the same rules (src/lib/access.js).
 *
 * Positions are saved a few at a time as people click, not the whole vote at
 * once, so two people working on the same vote don't undo each other's work.
 * Every change raises the vote's version by one and goes to everyone who has
 * it open (events.ts).
 */

export type Position = 'yes' | 'no' | 'other' | 'present'
export type Permission = 'edit' | 'view'
/** "owner" made it; "admin" is an admin who didn't; "edit" and "view" come from sharing. */
export type Access = 'owner' | 'admin' | Permission

export interface VoteData {
  voteType: string
  delegatesVote: boolean
  /** Candidate names, for each vote type that has candidates, by type id. */
  candidates: Partial<Record<string, string[]>>
  /** Bioguide id → position. Undecided members aren't listed. */
  positions: Record<string, Position>
}

export interface Settings {
  title?: string
  voteType?: string
  delegatesVote?: boolean
  candidates?: Partial<Record<string, string[]>>
}

export interface Share {
  personId: number
  name: string
  permission: Permission
}

export interface Vote extends VoteData {
  id: string
  title: string
  ownerId: number
  ownerName: string
  access: Access
  createdAt: string
  updatedAt: string
  updatedBy: { id: number; name: string }
  version: number
  shares: Share[]
}

/** One change to a vote, as the page that made it gets it back and as every open page gets it. */
export interface Change {
  voteId: string
  version: number
  at: string
  by: { id: number; name: string }
  /** The id the page gave this change, so it can tell its own changes from other people's. */
  requestId: string | null
  positions?: Record<string, Position | null>
  settings?: Settings
}

interface VoteRow {
  id: string
  title: string
  owner_id: number
  data: string
  created_at: string
  updated_at: string
  updated_by: number
  version: number
}

const EMPTY: VoteData = { voteType: DEFAULT_VOTE_TYPE_ID, delegatesVote: false, candidates: {}, positions: {} }
const UNKNOWN = 'Someone who’s gone'

export const canEdit = (access: Access | null) => access === 'owner' || access === 'admin' || access === 'edit'
export const canManage = (access: Access | null) => access === 'owner' || access === 'admin'

function accessTo(user: User, row: VoteRow): Access | null {
  if (row.owner_id === user.id) return 'owner'
  if (user.role === 'admin') return 'admin'
  return one<{ permission: Permission }>('SELECT permission FROM shares WHERE vote_id = ? AND person_id = ?', row.id, user.id)?.permission ?? null
}

/** The vote, if this person may do `need` with it. */
function find(user: User, id: string, need: 'view' | 'edit' | 'manage') {
  const row = one<VoteRow>('SELECT * FROM votes WHERE id = ?', id)
  const access = row ? accessTo(user, row) : null
  if (!row || !access) throw new HttpError(404, 'That vote isn’t here, or it isn’t shared with you.')
  if (need === 'edit' && !canEdit(access)) throw new HttpError(403, 'You can only view this vote.')
  if (need === 'manage' && !canManage(access)) throw new HttpError(403, 'Only the person who made this vote, or an admin, can do that.')
  return { row, access }
}

/** Whether this person may still see this vote (for live updates). */
export function canSee(user: User, id: string) {
  const row = one<VoteRow>('SELECT * FROM votes WHERE id = ?', id)
  return row != null && accessTo(user, row) != null
}

function sharesOf(ids: string[], who: Map<number, string>) {
  const byVote = new Map<string, Share[]>()
  if (!ids.length) return byVote
  const wanted = new Set(ids)
  for (const s of all<{ vote_id: string; person_id: number; permission: Permission }>('SELECT vote_id, person_id, permission FROM shares ORDER BY added_at')) {
    if (!wanted.has(s.vote_id)) continue
    const list = byVote.get(s.vote_id) ?? []
    list.push({ personId: s.person_id, name: who.get(s.person_id) ?? UNKNOWN, permission: s.permission })
    byVote.set(s.vote_id, list)
  }
  return byVote
}

function toVote(row: VoteRow, access: Access, who: Map<number, string>, shares: Share[]): Vote {
  return {
    ...EMPTY,
    ...(JSON.parse(row.data) as VoteData),
    id: row.id,
    title: row.title,
    ownerId: row.owner_id,
    ownerName: who.get(row.owner_id) ?? UNKNOWN,
    access,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: { id: row.updated_by, name: who.get(row.updated_by) ?? UNKNOWN },
    version: row.version,
    shares,
  }
}

/** Every vote this person can see, newest change first. Admins see them all. */
export function listVotes(user: User): Vote[] {
  const rows = all<VoteRow & { permission: Permission | null }>(
    `SELECT v.*, s.permission FROM votes v
       LEFT JOIN shares s ON s.vote_id = v.id AND s.person_id = ?
      WHERE ? OR v.owner_id = ? OR s.person_id IS NOT NULL
      ORDER BY v.updated_at DESC`,
    user.id,
    user.role === 'admin' ? 1 : 0,
    user.id,
  )
  const who = names()
  const shares = sharesOf(
    rows.map((r) => r.id),
    who,
  )
  return rows.map((r) => toVote(r, accessTo(user, r)!, who, shares.get(r.id) ?? []))
}

export function getVote(user: User, id: string): Vote {
  const { row, access } = find(user, id, 'view')
  const who = names()
  return toVote(row, access, who, sharesOf([id], who).get(id) ?? [])
}

/** A new vote: blank, a copy of one this person can see, or brought in from a browser's saved count. */
export function createVote(user: User, { title, copyFrom, data }: { title: string; copyFrom?: string; data?: VoteData }): Vote {
  const start = copyFrom ? (JSON.parse(find(user, copyFrom, 'view').row.data) as VoteData) : (data ?? EMPTY)
  const id = crypto.randomBytes(9).toString('base64url')
  const now = new Date().toISOString()
  tx(() => {
    run(
      'INSERT INTO votes (id, title, owner_id, data, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      title,
      user.id,
      JSON.stringify({ ...EMPTY, ...start }),
      now,
      now,
      user.id,
    )
    countChange()
  })
  return getVote(user, id)
}

/** Saves a change to the vote and stamps it with who and when. */
function save(user: User, row: VoteRow, title: string, data: VoteData, change: Omit<Change, 'voteId' | 'version' | 'at' | 'by'>): Change {
  const at = new Date().toISOString()
  const version = row.version + 1
  run('UPDATE votes SET title = ?, data = ?, updated_at = ?, updated_by = ?, version = ? WHERE id = ?', title, JSON.stringify(data), at, user.id, version, row.id)
  countChange()
  return { voteId: row.id, version, at, by: { id: user.id, name: user.name }, ...change }
}

export function updateSettings(user: User, id: string, settings: Settings, requestId: string | null): Change {
  return tx(() => {
    const { row } = find(user, id, 'edit')
    const data = { ...EMPTY, ...(JSON.parse(row.data) as VoteData) }
    const next: VoteData = {
      ...data,
      voteType: settings.voteType ?? data.voteType,
      delegatesVote: settings.delegatesVote ?? data.delegatesVote,
      candidates: settings.candidates ? { ...data.candidates, ...settings.candidates } : data.candidates,
    }
    return save(user, row, settings.title ?? row.title, next, { requestId, settings })
  })
}

/** Sets some members' positions; null makes them undecided. */
export function setPositions(user: User, id: string, changes: Record<string, Position | null>, requestId: string | null): Change {
  return tx(() => {
    const { row } = find(user, id, 'edit')
    const data = { ...EMPTY, ...(JSON.parse(row.data) as VoteData) }
    const positions = { ...data.positions }
    for (const [member, position] of Object.entries(changes)) {
      if (position === null) delete positions[member]
      else positions[member] = position
    }
    return save(user, row, row.title, { ...data, positions }, { requestId, positions: changes })
  })
}

/** Deletes a vote for everyone. A backup is taken first, in case it was a mistake. */
export function deleteVote(user: User, id: string) {
  find(user, id, 'manage')
  snapshot('before-delete')
  tx(() => {
    run('DELETE FROM votes WHERE id = ?', id)
    countChange()
  })
}

/** Shares a vote with someone, or changes what they can do with it. */
export function setShare(user: User, id: string, personId: number, permission: Permission) {
  const { row } = find(user, id, 'manage')
  if (personId === row.owner_id) throw new HttpError(400, 'That’s who made it; they can already do everything.')
  run(
    `INSERT INTO shares (vote_id, person_id, permission, added_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (vote_id, person_id) DO UPDATE SET permission = excluded.permission`,
    id,
    personId,
    permission,
    new Date().toISOString(),
  )
  countChange()
}

/** Stops sharing with someone. People can also take themselves off a vote shared with them. */
export function removeShare(user: User, id: string, personId: number) {
  if (personId === user.id) find(user, id, 'view')
  else find(user, id, 'manage')
  run('DELETE FROM shares WHERE vote_id = ? AND person_id = ?', id, personId)
  countChange()
}
