import Logo from "./Logo";
import ProgressBar from "./ProgressBar";
import { StatusPill } from "./TallyPanel";
import { Moon, Redo, Reset, Sun, Undo } from "./Icons";
import "./AppHeader.css";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";

function AppHeader({ tally, type, labels, showMiniTally, theme, onToggleTheme, canUndo, canRedo, onUndo, onRedo, onReset, hasVotes }) {
  return (
    <header className="app-header glass">
      <div className="app-header-inner">
        <div className="brand">
          <Logo />
          <span className="brand-name">Whip Tracker</span>
        </div>

        <div className={`mini-tally${showMiniTally ? " shown" : ""}`} aria-hidden={!showMiniTally}>
          <span className="mini-tally-type">{type.name}</span>
          <ProgressBar tally={tally} type={type} labels={labels} compact />
          <span className="mini-tally-score">
            {tally.counts.yes}
            <span className="mini-tally-of">/{tally.needed}</span>
          </span>
          <StatusPill tally={tally} type={type} labels={labels} compact />
        </div>

        <div className="header-actions">
          <button type="button" className="icon-button" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title={`Undo (${mod}Z)`}>
            <Undo />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo"
            title={`Redo (${isMac ? "⇧⌘Z" : "Ctrl+Y"})`}
          >
            <Redo />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onReset}
            disabled={!hasVotes}
            aria-label="Clear all positions"
            title="Clear all positions"
          >
            <Reset />
          </button>
          <span className="header-divider" aria-hidden="true" />
          <button
            type="button"
            className="icon-button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
