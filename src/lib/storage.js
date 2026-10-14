import { useEffect, useState } from "react";
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from "../constants";

// What stays in this browser: the light or dark setting, and the whip count saved here
// before votes moved to the server, so it can be brought in once.

const THEME_KEY = "whip-tracker:theme";
const IMPORTED_KEY = "whip-tracker:imported";

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // Blocked storage: behave as if nothing was saved.
  }
}

function write(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked; the setting lasts for this visit only.
  }
}

function savedTheme() {
  const theme = read(THEME_KEY);
  if (theme === "dark" || theme === "light") return theme;
  try {
    return JSON.parse(read(STORAGE_KEY) || "{}").settings?.theme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Light or dark, remembered in this browser. public/theme.js applies it before the first paint. */
export function useTheme() {
  const [theme, setTheme] = useState(savedTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    write(THEME_KEY, theme);
  }, [theme]);
  return [theme, () => setTheme((current) => (current === "dark" ? "light" : "dark"))];
}

function votesFromLegacy(raw) {
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed?.members;
  if (!Array.isArray(list)) return {};
  return Object.fromEntries(list.filter((member) => member.vote).map((member) => [member.id, member.vote]));
}

/**
 * The count this browser kept before votes were saved on the server, as vote data, or null
 * if there's none or it was already brought in (or dismissed).
 */
export function browserVote() {
  if (read(IMPORTED_KEY)) return null;
  try {
    const raw = read(STORAGE_KEY);
    if (raw) {
      const { votes = {}, settings = {} } = JSON.parse(raw);
      if (!Object.keys(votes).length) return null;
      return {
        voteType: settings.voteType ?? "passage",
        delegatesVote: settings.delegatesVote ?? false,
        candidates: settings.candidates ?? {},
        positions: votes,
      };
    }
    const legacy = read(LEGACY_STORAGE_KEY);
    if (legacy) {
      const positions = votesFromLegacy(legacy);
      if (Object.keys(positions).length) return { voteType: "passage", delegatesVote: false, candidates: {}, positions };
    }
  } catch {
    // Unreadable: nothing to bring in.
  }
  return null;
}

/** Stops offering the browser's old count. It stays in the browser untouched. */
export const markBrowserVoteHandled = () => write(IMPORTED_KEY, new Date().toISOString());
