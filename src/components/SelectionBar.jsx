import { VOTE_OPTIONS } from "../constants";
import { Close } from "./Icons";
import "./SelectionBar.css";

const DEFAULT_SHORTCUTS = { yes: "Y", no: "N", present: "P", undecided: "U" };
const CANDIDATE_SHORTCUTS = { yes: "1", no: "2", other: "3", present: "P", undecided: "U" };

/** Keyboard shortcut for each position under this vote type. */
export function shortcutsFor(type) {
  return type.candidates ? CANDIDATE_SHORTCUTS : DEFAULT_SHORTCUTS;
}

function SelectionBar({ count, visibleCount, sharedVote, labels, shortcuts, onVote, onSelectAll, onDeselect }) {
  const actions = [...VOTE_OPTIONS.filter((option) => labels[option]), "undecided"];

  return (
    <div className="selection-bar glass" role="toolbar" aria-label={`${count} selected`}>
      <div className="selection-summary">
        <span className="selection-count">{count} selected</span>
        {count < visibleCount && (
          <button type="button" className="link-button" onClick={onSelectAll}>
            Select all {visibleCount}
          </button>
        )}
      </div>

      <div className={`selection-actions${actions.length > 4 ? " dense" : ""}`} role="group" aria-label="Set position">
        <span className="selection-label">Set to</span>
        {actions.map((action) => {
          const vote = action === "undecided" ? null : action;
          return (
            <button
              type="button"
              key={action}
              className={`selection-action ${action}`}
              aria-pressed={sharedVote === vote}
              onClick={() => onVote(vote)}
              title={`${labels[action]} (${shortcuts[action]})`}
            >
              <span className="selection-action-label">{labels[action]}</span>
              <kbd>{shortcuts[action]}</kbd>
            </button>
          );
        })}
      </div>

      <button type="button" className="icon-button" onClick={onDeselect} aria-label="Deselect all" title="Deselect (Esc)">
        <Close width={18} height={18} />
      </button>
    </div>
  );
}

export default SelectionBar;
