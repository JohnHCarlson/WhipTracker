import { useCallback, useReducer } from "react";

const LIMIT = 200;

function applyVotes(votes, ids, vote) {
  let changed = false;
  const next = { ...votes };
  for (const id of ids) {
    if ((next[id] ?? null) === vote) continue;
    changed = true;
    if (vote === null) delete next[id];
    else next[id] = vote;
  }
  return changed ? next : votes;
}

function reducer(state, action) {
  switch (action.type) {
    case "set": {
      const next = applyVotes(state.present, action.ids, action.vote);
      if (next === state.present) return state;
      return { past: [...state.past, state.present].slice(-LIMIT), present: next, future: [] };
    }
    case "clear-all": {
      if (Object.keys(state.present).length === 0) return state;
      return { past: [...state.past, state.present].slice(-LIMIT), present: {}, future: [] };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
    }
    default:
      return state;
  }
}

/** Votes (member id -> position) with undo/redo. */
export function useVoteHistory(initialVotes) {
  const [state, dispatch] = useReducer(reducer, { past: [], present: initialVotes, future: [] });
  return {
    votes: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    setVotes: useCallback((ids, vote) => dispatch({ type: "set", ids, vote }), []),
    clearAll: useCallback(() => dispatch({ type: "clear-all" }), []),
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),
  };
}
