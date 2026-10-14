import { useSyncExternalStore } from "react";

// Talking to the server (server/), and who's signed in. Pages call the functions here,
// never fetch() directly. The open vote's live updates are in voteStore.js.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, method = "GET", body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      // Every change is sent as JSON, even an empty one: the server turns anything else away.
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Signed out somewhere else, or removed: back to the sign-in page.
    if (res.status === 401 && auth.status === "signed-in") signedOut();
    throw new ApiError(res.status, data?.error ?? `The server answered with an error (${res.status}).`);
  }
  return data;
}

export const errorMessage = (e) => (e instanceof Error ? e.message : String(e));

// ------------------------------------------------------------------ state

/** { status: "loading" | "unreachable" | "signed-out" } or { status: "signed-in", user } */
let auth = { status: "loading" };
/** A newer version of the site is live than the one running in this page. */
let updateReady = false;

const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useAuth = () => useSyncExternalStore(subscribe, () => auth);
export function useUser() {
  const current = useAuth();
  return current.status === "signed-in" ? current.user : null;
}
export const useUpdateReady = () => useSyncExternalStore(subscribe, () => updateReady);

/** This page's own build: its main script, e.g. "/assets/index-BSx6-ntW.js" (see server/app.ts). */
const ownBuild = document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute("src") ?? null;

/** Called with the build a live connection reports; a different one means a deploy happened. */
export function noteBuild(build) {
  if (build && ownBuild && build !== ownBuild && !updateReady) {
    updateReady = true;
    emit();
  }
}

// ------------------------------------------------------------------ signing in

function signedIn(user) {
  auth = { status: "signed-in", user };
  emit();
}

function signedOut() {
  auth = { status: "signed-out" };
  emit();
}

/** Asks the server who's signed in (on page load). */
export async function checkSession() {
  try {
    const { user } = await api("/me");
    if (user) signedIn(user);
    else signedOut();
  } catch {
    auth = { status: "unreachable" };
    emit();
  }
}
void checkSession();

export async function signIn(email, password) {
  const { user } = await api("/login", "POST", { email, password });
  signedIn(user);
}

export async function signOut() {
  await api("/logout", "POST").catch(() => {});
  signedOut();
}

export const getInvite = (token) => api(`/invite/${encodeURIComponent(token)}`);

/** Sets a password from an invite link, and signs in. */
export async function acceptInvite(token, password) {
  const { user } = await api(`/invite/${encodeURIComponent(token)}`, "POST", { password });
  signedIn(user);
}

// ------------------------------------------------------------------ votes

export const listVotes = () => api("/votes");
/** A new vote: { title }, plus `copyFrom` (a vote id) or `data` (a browser's saved count). */
export const createVote = (vote) => api("/votes", "POST", vote);
export const deleteVote = (id) => api(`/votes/${id}`, "DELETE");
/** Everyone who can use the app, for sharing. */
export const listDirectory = () => api("/directory");
/** Resolves to the vote with its new list of shares. */
export const shareVote = (id, personId, permission) => api(`/votes/${id}/shares/${personId}`, "PUT", { permission });
export const unshareVote = (id, personId) => api(`/votes/${id}/shares/${personId}`, "DELETE");

// ------------------------------------------------------------------ people (admins and the owner)

export const listPeople = () => api("/people");
/** { email, name, access: { app: role } } */
export const addPerson = (person) => api("/people", "POST", person);
/** { name?, access?: { app: role | null } } */
export const updatePerson = (id, changes) => api(`/people/${id}`, "PATCH", changes);
export const newInvite = (id) => api(`/people/${id}/invite`, "POST");
export const deletePerson = (id) => api(`/people/${id}`, "DELETE");
