import type { Context } from 'hono'
import { streamSSE, type SSEStreamingApi } from 'hono/streaming'

/*
 * Live updates. A page with a vote open keeps one connection here
 * (Server-Sent Events) for that vote, and every change to it is pushed to
 * everyone who has it open.
 */

const streams = new Map<SSEStreamingApi, { userId: number; voteId: string }>()

/** Keeps a page's connection open until it goes away, or loses access. */
export function openStream(c: Context, userId: number, voteId: string, build: string | null) {
  return streamSSE(c, async (stream) => {
    streams.set(stream, { userId, voteId })
    stream.onAbort(() => {
      streams.delete(stream)
    })
    // The build lets a page left open across a deploy offer to reload.
    await stream.writeSSE({ event: 'hello', data: JSON.stringify({ build }), retry: 3000 })
    // A ping every 25 seconds keeps proxies and phones from dropping a quiet
    // connection, and lets the page notice when it has gone dead.
    while (!stream.aborted && !stream.closed) {
      await stream.sleep(25_000)
      await stream.writeSSE({ event: 'ping', data: '' })
    }
    streams.delete(stream)
  })
}

/**
 * "change": positions or settings changed. "access": who it's shared with changed, so
 * pages check what they can still do. "deleted": it's gone.
 */
export function broadcast(voteId: string, event: 'change' | 'access' | 'deleted', data: unknown) {
  const message = { event, data: JSON.stringify(data) }
  for (const [stream, s] of streams) if (s.voteId === voteId) void stream.writeSSE(message)
}

/** Closes the connections of someone removed from the app, or from one vote. */
export function disconnect(userId: number, voteId?: string) {
  for (const [stream, s] of streams) if (s.userId === userId && (!voteId || s.voteId === voteId)) stream.abort()
}

/** Closes every connection to a vote (after it's deleted). */
export function disconnectVote(voteId: string) {
  for (const [stream, s] of streams) if (s.voteId === voteId) stream.abort()
}
