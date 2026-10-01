import { LEGACY_STORAGE_KEY, STORAGE_KEY } from "../constants";

// Only votes and preferences are saved. The roster always comes from members.json,
// so adding or editing members never gets shadowed by a stale saved copy.

function votesFromLegacy(raw) {
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed?.members;
  if (!Array.isArray(list)) return {};
  return Object.fromEntries(list.filter((member) => member.vote).map((member) => [member.id, member.vote]));
}

export function loadSaved() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { votes: parsed.votes ?? {}, settings: parsed.settings ?? {} };
    }
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return { votes: votesFromLegacy(legacy), settings: {} };
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  return { votes: {}, settings: {} };
}

export function save(votes, settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ votes, settings }));
  } catch {
    // Storage full or blocked; the app still works for this session.
  }
}
