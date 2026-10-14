import { useCallback, useReducer, useRef } from "react";

const LIMIT = 200;

// Undo and redo for this person's own changes to positions. Each step remembers what the
// members it touched were before and after, not the whole vote, so undoing never reverts
// what someone else changed in the meantime.

function reducer(state, action) {
  switch (action.type) {
    case "push":
      return { past: [...state.past, action.step].slice(-LIMIT), future: [] };
    case "undo":
      return { past: state.past.slice(0, -1), future: [state.past[state.past.length - 1], ...state.future] };
    case "redo":
      return { past: [...state.past, state.future[0]], future: state.future.slice(1) };
    case "reset":
      return { past: [], future: [] };
    default:
      return state;
  }
}

/**
 * `votes` is member id → position as shown; `apply` saves changes ({ id: position | null }).
 * Starts empty for each vote: pass a `key` that changes with it.
 */
export function useVoteHistory(votes, apply) {
  const [state, dispatch] = useReducer(reducer, { past: [], future: [] });
  const ref = useRef({ votes, state });
  ref.current = { votes, state };

  const setVotes = useCallback(
    (ids, vote) => {
      const before = {};
      const after = {};
      for (const id of ids) {
        const current = ref.current.votes[id] ?? null;
        if (current === vote) continue;
        before[id] = current;
        after[id] = vote;
      }
      if (Object.keys(after).length === 0) return;
      apply(after);
      dispatch({ type: "push", step: { before, after } });
    },
    [apply],
  );

  const clearAll = useCallback(() => setVotes(Object.keys(ref.current.votes), null), [setVotes]);

  const undo = useCallback(() => {
    const step = ref.current.state.past.at(-1);
    if (!step) return;
    apply(step.before);
    dispatch({ type: "undo" });
  }, [apply]);

  const redo = useCallback(() => {
    const step = ref.current.state.future[0];
    if (!step) return;
    apply(step.after);
    dispatch({ type: "redo" });
  }, [apply]);

  return { canUndo: state.past.length > 0, canRedo: state.future.length > 0, setVotes, clearAll, undo, redo };
}
