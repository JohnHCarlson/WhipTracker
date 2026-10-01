import { neededPhrase } from "../lib/voteTypes";
import "./ProgressBar.css";

const pct = (value, total) => `${total ? (value / total) * 100 : 0}%`;

/**
 * Yes fills from the left; No, Other and Present stack in from the right. The line
 * marks votes needed: Yes reaching it means the vote is won, and the right-hand
 * block crossing it means it can't be.
 */
function ProgressBar({ tally, type, labels, compact = false }) {
  const { counts, total, needed } = tally;
  const neededText = neededPhrase(type, needed);
  const position = total ? needed / total : 0;
  // Keep the label inside the card when the line sits near either end.
  const edge = position > 0.88 ? " edge-end" : position < 0.12 ? " edge-start" : "";
  const summary = ["yes", "no", "other", "present", "undecided"]
    .filter((kind) => labels[kind])
    .map((kind) => `${counts[kind]} ${labels[kind]}`)
    .join(", ");

  return (
    <div className={compact ? "bar compact" : "bar"} role="img" aria-label={`${summary}. ${needed} needed.`}>
      <div className="bar-track">
        <span className="bar-seg yes" style={{ left: 0, width: pct(counts.yes, total) }} />
        <span
          className="bar-seg present"
          style={{ right: pct(counts.no + counts.other, total), width: pct(counts.present, total) }}
        />
        <span className="bar-seg other" style={{ right: pct(counts.no, total), width: pct(counts.other, total) }} />
        <span className="bar-seg no" style={{ right: 0, width: pct(counts.no, total) }} />
      </div>
      <div className={`bar-threshold ${tally.status}${edge}`} style={{ left: pct(needed, total) }}>
        {!compact && <span className="bar-threshold-label">{neededText}</span>}
      </div>
    </div>
  );
}

export default ProgressBar;
