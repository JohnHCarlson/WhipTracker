import { forwardRef, useState } from "react";
import { STATE_NAMES } from "../constants";
import ProgressBar from "./ProgressBar";
import VoteTypePicker from "./VoteTypePicker";
import { ChevronDown, Info, Warning } from "./Icons";
import "./TallyPanel.css";

const KINDS = ["yes", "no", "other", "present", "undecided"];

function statusText(tally, type, labels) {
  const unit = (n) => (tally.unit === "states" ? (n === 1 ? " state" : " states") : "");
  // Candidate elections name who the status is about: "Johnson needs 6 more".
  const who = type.candidates ? `${labels.yes} ` : "";
  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  if (tally.status === "secured") {
    return {
      title: capitalize(`${who}has the votes`),
      detail: tally.margin > 0 ? `${tally.margin}${unit(tally.margin)} to spare` : "None to spare",
    };
  }
  if (tally.status === "defeated") {
    return {
      title: capitalize(`${who}${type.defeatedLabel ?? "can't pass"}`),
      detail:
        tally.counts.undecided > 0
          ? `Even if every ${tally.unit === "states" ? "state in play" : "undecided member"} breaks your way`
          : `Short by ${tally.margin}${unit(tally.margin)}`,
    };
  }
  return {
    title: capitalize(`${who}needs ${tally.margin} more${unit(tally.margin)}`),
    detail: `${tally.counts.undecided} ${tally.unit === "states" ? "in play" : "undecided"}`,
  };
}

export function StatusPill({ tally, type, labels, compact = false }) {
  const { title, detail } = statusText(tally, type, labels);
  return (
    <div className={`status-pill ${tally.status}${compact ? " compact" : ""}`} role="status">
      <span className="status-dot" aria-hidden="true" />
      <span className="status-title">{title}</span>
      {!compact && <span className="status-detail">{detail}</span>}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function Count({ kind, label, value, total }) {
  return (
    <div className={`count ${kind}`}>
      <span className="count-label" title={label}>
        <span className="count-swatch" aria-hidden="true" />
        <span className="count-name">{label}</span>
      </span>
      <span className="count-value">{value}</span>
      <span className="count-share">{total ? Math.round((value / total) * 100) : 0}%</span>
    </div>
  );
}

function CandidateFields({ type, names, onChange }) {
  const slots = ["yes", "no", "other"];
  return (
    <div className="candidates" role="group" aria-label="Candidates">
      {type.candidates.placeholders.map((placeholder, i) => (
        <label className={`candidate ${slots[i]}`} key={placeholder}>
          <span className="candidate-dot" aria-hidden="true" />
          <input
            type="text"
            value={names[i] ?? ""}
            placeholder={placeholder}
            maxLength={24}
            spellCheck={false}
            aria-label={placeholder}
            onChange={(event) => {
              const next = [...names];
              next[i] = event.target.value;
              onChange(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}

function Delegations({ delegations, labels }) {
  const resultText = { yes: labels.yes, no: labels.no, other: labels.other, divided: "Divided", vacant: "Vacant", open: "In play" };
  return (
    <div className="delegations">
      <span className="delegations-title">Delegations</span>
      <ul>
        {delegations.map(({ state, counts, result }) => (
          <li key={state} className={`delegation ${result}`} title={STATE_NAMES[state]}>
            <span className="delegation-state">{state}</span>
            <span className="delegation-score">
              {counts.yes}–{counts.no}
              {counts.other > 0 && `–${counts.other}`}
              {counts.present > 0 && `, ${counts.present} present`}
              {counts.undecided > 0 && `, ${counts.undecided} undecided`}
            </span>
            <span className="delegation-result">{resultText[result]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TallyPanel = forwardRef(function TallyPanel(
  { tally, type, labels, onTypeChange, delegatesVote, onDelegatesVoteChange, candidateNames, onCandidateNamesChange },
  ref,
) {
  const [showAbout, setShowAbout] = useState(false);
  const countLabels = type.unit === "states" ? { ...labels, present: "Divided", undecided: "In play" } : labels;
  const kinds = KINDS.filter((kind) => countLabels[kind]);

  return (
    <section className="tally card" ref={ref} aria-label="Vote tally">
      <div className="tally-head">
        <div className="tally-type">
          <span className="eyebrow">Vote type</span>
          <VoteTypePicker value={type.id} onChange={onTypeChange} />
          <div className="tally-type-actions">
            <button
              type="button"
              className="link-button"
              aria-expanded={showAbout}
              onClick={() => setShowAbout((shown) => !shown)}
            >
              <Info width={16} height={16} />
              How it's counted
              <ChevronDown width={14} height={14} className={showAbout ? "flip" : ""} />
            </button>
            {type.allowsDelegateOption && (
              <label className="switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={delegatesVote}
                  onChange={(event) => onDelegatesVoteChange(event.target.checked)}
                />
                <span className="switch-track" aria-hidden="true" />
                Delegates vote
              </label>
            )}
          </div>
        </div>

        <div className="tally-stats">
          <Stat label={type.totalLabel ?? "Voting members"} value={tally.total} />
          <Stat label={type.neededLabel ?? (type.candidates ? "Needed to win" : "Needed to pass")} value={tally.needed} />
          <StatusPill tally={tally} type={type} labels={labels} />
        </div>
      </div>

      {showAbout && <p className="about">{type.about}</p>}

      {type.candidates && <CandidateFields type={type} names={candidateNames} onChange={onCandidateNamesChange} />}

      <ProgressBar tally={tally} type={type} labels={countLabels} />

      <div className="counts">
        {kinds.map((kind) => (
          <Count key={kind} kind={kind} label={countLabels[kind]} value={tally.counts[kind]} total={tally.total} />
        ))}
      </div>

      {tally.delegations && <Delegations delegations={tally.delegations} labels={labels} />}

      {tally.notes.length > 0 && (
        <ul className="notes">
          {tally.notes.map((note) => (
            <li key={note.text} className={`note ${note.tone}`}>
              {note.tone === "warning" ? <Warning width={16} height={16} /> : <Info width={16} height={16} />}
              {note.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});

export default TallyPanel;
