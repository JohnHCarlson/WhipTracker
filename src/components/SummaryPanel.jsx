import "./SummaryPanel.css";
import { voteTypes } from "../constants";

function SummaryPanel({ summary, voteType, setVoteType }) {
  const majorityMarkerPosition = "50%";
  const progressTrackStyle = {
    background: `linear-gradient(
      90deg,
      #4ade80 0%,
      #4ade80 ${summary.yesShare * 100}%,
      #14233a ${summary.yesShare * 100}%,
      #14233a ${100 - (summary.presentShare + summary.noShare) * 100}%,
      #facc15 ${100 - (summary.presentShare + summary.noShare) * 100}%,
      #facc15 ${100 - summary.noShare * 100}%,
      #f87171 ${100 - summary.noShare * 100}%,
      #f87171 100%
    )`,
  };

  return (
    <section className="summary-panel">
      <div className="vote-type-panel">
        <label className="vote-type-select">
          <span>Vote type</span>
          <select value={voteType} onChange={(event) => setVoteType(event.target.value)}>
            {voteTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <p className="threshold-caption">Current rule: {summary.thresholdLabel}</p>
      </div>
      <div className="progress-shell">
        <span className="progress-label left">Yes</span>
        <div className="progress-track" aria-label="Whip progress" style={progressTrackStyle}>
          <div className="majority-mark" style={{ left: majorityMarkerPosition }} />
        </div>
        <span className="progress-label right">No</span>
      </div>

      <div className="summary-grid">
        <article>
          <span>Yes</span>
          <strong>{summary.yes}</strong>
        </article>
        <article>
          <span>No</span>
          <strong>{summary.no}</strong>
        </article>
        <article>
          <span>Present</span>
          <strong>{summary.present}</strong>
        </article>
      </div>
    </section>
  );
}

export default SummaryPanel;
