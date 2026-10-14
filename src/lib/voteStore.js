import { useSyncExternalStore } from "react";
import { ApiError, api, checkSession, noteBuild } from "./api";

// The vote that's open, kept in step with the server and everyone else who has it open.
//
// Changes show on screen right away and are sent in the order they were made, one request
// at a time. Until the server confirms one, it waits in `queue` and is laid over the last
// version the server sent. If the connection drops, changes wait and go out when it's back,
// even after leaving the vote (the page warns before closing with any still waiting).
//
// The server sends every change, from anyone, down a live connection (Server-Sent Events).
// Each raises the vote's version by one. A change is applied only if it's the next version;
// if one was missed, the vote is loaded again. The page's own changes come back the same
// way, recognized by their request id.

const empty = {
  id: null,
  /** "loading" | "ready" | "missing" (not here, or no longer shared) | "deleted" */
  status: "loading",
  /** The vote with waiting changes applied: what's on screen. */
  vote: null,
  /** Changes to this vote not yet confirmed. */
  pending: 0,
  /** Saving is waiting on the connection. */
  offline: false,
  /** "connecting" | "live" | "reconnecting" */
  connection: "connecting",
  /** A change the server turned down, to show once. */
  error: null,
  /** Who deleted it, when status is "deleted". */
  deletedBy: null,
};

let state = empty;
/** The open vote as the server last confirmed it. */
let server = null;
/** Changes not yet confirmed, for any vote: [{ voteId, requestId, kind, payload, sent }] */
let queue = [];
let sending = false;

const mine = () => queue.filter((op) => op.voteId === state.id);

const listeners = new Set();
function emit() {
  state = { ...state, vote: server ? overlay(server, mine()) : null, pending: mine().length };
  listeners.forEach((listener) => listener());
}
function set(changes) {
  state = { ...state, ...changes };
  emit();
}

export const useOpenVote = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );

function applyPositions(positions, changes) {
  const next = { ...positions };
  for (const [id, position] of Object.entries(changes)) {
    if (position === null) delete next[id];
    else next[id] = position;
  }
  return next;
}

function applySettings(vote, settings) {
  return {
    ...vote,
    ...settings,
    candidates: settings.candidates ? { ...vote.candidates, ...settings.candidates } : vote.candidates,
  };
}

function overlay(base, ops) {
  let vote = base;
  for (const op of ops) {
    vote = op.kind === "positions" ? { ...vote, positions: applyPositions(vote.positions, op.payload) } : applySettings(vote, op.payload);
  }
  return vote;
}

// ------------------------------------------------------------------ the server's changes

function applyChange(change) {
  queue = queue.filter((op) => op.requestId !== change.requestId);
  if (!server || change.voteId !== server.id || change.version <= server.version) return emit();
  if (change.version !== server.version + 1) return void reload();
  let next = { ...server, version: change.version, updatedAt: change.at, updatedBy: change.by };
  if (change.positions) next.positions = applyPositions(next.positions, change.positions);
  if (change.settings) next = applySettings(next, change.settings);
  server = next;
  emit();
}

function gone(status, deletedBy = null) {
  disconnect();
  queue = queue.filter((op) => op.voteId !== state.id);
  server = null;
  set({ status, deletedBy });
}

let loading = null;
let loadAgain = false;

/** Loads the whole vote again: on opening, after reconnecting, or after a missed change. */
async function reload() {
  if (!state.id) return;
  if (loading) {
    loadAgain = true;
    return;
  }
  const id = state.id;
  loading = (async () => {
    try {
      const vote = await api(`/votes/${id}`);
      if (state.id !== id) return;
      // A change can land between the request and the answer; keep whichever is newer.
      if (!server || vote.version >= server.version) server = vote;
      set({ status: "ready" });
    } catch (e) {
      if (state.id !== id) return;
      if (e instanceof ApiError && (e.status === 404 || e.status === 403)) gone("missing");
      else setTimeout(() => state.id === id && void reload(), 5000);
    }
  })();
  await loading;
  loading = null;
  if (loadAgain) {
    loadAgain = false;
    await reload();
  }
}

// ------------------------------------------------------------------ sending changes

const newRequestId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function enqueue(kind, payload) {
  if (!server) return;
  // Changes made while another is on its way join the next request.
  const last = queue[queue.length - 1];
  if (last && !last.sent && last.kind === kind && last.voteId === server.id) {
    last.payload =
      kind === "positions"
        ? { ...last.payload, ...payload }
        : { ...last.payload, ...payload, candidates: payload.candidates ? { ...last.payload.candidates, ...payload.candidates } : last.payload.candidates };
  } else {
    queue.push({ voteId: server.id, requestId: newRequestId(), kind, payload, sent: false });
  }
  emit();
  void sendNext();
}

async function sendNext() {
  if (sending) return;
  const op = queue.find((o) => !o.sent);
  if (!op) return;
  sending = true;
  op.sent = true;
  try {
    const change =
      op.kind === "positions"
        ? await api(`/votes/${op.voteId}/positions`, "PATCH", { changes: op.payload, requestId: op.requestId })
        : await api(`/votes/${op.voteId}`, "PATCH", { settings: op.payload, requestId: op.requestId });
    if (state.offline) set({ offline: false });
    applyChange(change);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) {
      // Not reached, or the server is restarting: try again shortly.
      op.sent = false;
      sending = false;
      set({ offline: true });
      setTimeout(() => void sendNext(), 3000);
      return;
    }
    // Turned down (no longer allowed to edit, say): drop it and show what the server has.
    queue = queue.filter((o) => o !== op);
    if (op.voteId === state.id) {
      set({ error: e.message });
      void reload();
    }
  }
  sending = false;
  void sendNext();
}

/** Sets some members' positions: { bioguideId: "yes" | "no" | "other" | "present" | null }. */
export const setPositions = (changes) => enqueue("positions", changes);
/** Changes { title, voteType, delegatesVote, candidates: { typeId: names } }. */
export const updateSettings = (settings) => enqueue("settings", settings);
export const clearError = () => set({ error: null });

window.addEventListener("beforeunload", (event) => {
  if (queue.length) event.preventDefault();
});

// ------------------------------------------------------------------ the live connection

let source = null;
let lastHeard = 0;

function setConnection(connection) {
  if (connection !== state.connection) set({ connection });
}

function connect() {
  source?.close();
  const id = state.id;
  const es = new EventSource(`/api/events/${id}`);
  source = es;
  lastHeard = Date.now();
  const heard = () => {
    lastHeard = Date.now();
  };
  // Sent first on every (re)connection: load everything, since changes may have been missed.
  es.addEventListener("hello", (message) => {
    heard();
    noteBuild(JSON.parse(message.data).build);
    setConnection("live");
    void reload();
  });
  es.addEventListener("ping", heard);
  es.addEventListener("change", (message) => {
    heard();
    applyChange(JSON.parse(message.data));
  });
  // Sharing changed: what this person can do may have too.
  es.addEventListener("access", () => {
    heard();
    void reload();
  });
  es.addEventListener("deleted", (message) => gone("deleted", JSON.parse(message.data).by));
  es.addEventListener("error", () => {
    if (source !== es) return;
    setConnection(state.status === "ready" ? "reconnecting" : "connecting");
    // The browser retries by itself unless the server turned the connection down
    // (signed out, or no longer shared). Then find out which, and try again.
    if (es.readyState === EventSource.CLOSED) {
      source = null;
      setTimeout(async () => {
        if (state.id !== id || state.status === "missing" || state.status === "deleted") return;
        await checkSession();
        await reload();
        if (state.id === id && state.status === "ready" && !source) connect();
      }, 3000);
    }
  });
}

function disconnect() {
  source?.close();
  source = null;
}

// Phones pause pages in the background and connections die quietly; the server pings
// every 25 seconds, so a minute of silence means start over.
setInterval(() => {
  if (source && Date.now() - lastHeard > 60_000) {
    setConnection("reconnecting");
    connect();
  }
}, 10_000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && source && Date.now() - lastHeard > 30_000) connect();
});

// ------------------------------------------------------------------ opening and closing

/** Opens a vote: loads it and keeps it current until `closeVote`. */
export function openVote(id) {
  if (state.id === id) return;
  disconnect();
  server = null;
  state = { ...empty, id };
  emit();
  void reload();
  connect();
}

/** Stops following the open vote. Its waiting changes still get sent. */
export function closeVote() {
  disconnect();
  server = null;
  state = empty;
  emit();
}
