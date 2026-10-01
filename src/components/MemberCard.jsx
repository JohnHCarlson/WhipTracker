import { memo, useState } from "react";
import { CAUCUSES, PARTIES, VOTE_OPTIONS } from "../constants";
import { Check } from "./Icons";
import "./MemberCard.css";

const photoUrl = (id) => `${import.meta.env.BASE_URL}members/${id}.webp`;

function initials(name) {
  const parts = name.split(" ").filter((part) => /^[A-Za-zÀ-ÿ]/.test(part));
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function Avatar({ member }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="avatar monogram" aria-hidden="true">
        {initials(member.name)}
      </span>
    );
  }
  return (
    <img
      className="avatar"
      src={photoUrl(member.id)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function MemberCard({ member, vote, labels, selected, selectionActive, onToggleSelect, onVote }) {
  const options = VOTE_OPTIONS.filter((option) => labels[option]);
  const district = member.delegate ? `${member.district.split("-")[0]} · ${member.role ?? "Delegate"}` : member.district;

  const toggle = (event) => onToggleSelect(member.id, event.shiftKey);

  return (
    <article
      className={`member ${vote ?? "undecided"}${selected ? " selected" : ""}${selectionActive ? " selecting" : ""}`}
      onClick={(event) => {
        if (event.target.closest("button")) return;
        toggle(event);
      }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`Select ${member.name}`}
        className="select-toggle"
        onClick={toggle}
      >
        <Check width={14} height={14} strokeWidth={2.4} />
      </button>

      <div className="member-head">
        <div className="avatar-ring">
          <Avatar member={member} />
        </div>
        <div className="member-id">
          <h3 className="member-name">{member.name}</h3>
          <p className="member-meta">
            <span className={`party-dot party-${member.party}`} aria-hidden="true" />
            <span title={PARTIES[member.party]?.name}>{member.party}</span>
            <span aria-hidden="true">·</span>
            <span>{district}</span>
          </p>
        </div>
      </div>

      <ul className="member-tags" aria-label="Caucuses">
        {member.groups.map((group) => (
          <li key={group} title={CAUCUSES[group]?.name}>
            {group}
          </li>
        ))}
      </ul>

      <div
        className={`segmented${options.length > 3 ? " dense" : ""}`}
        role="group"
        aria-label={`Position for ${member.name}`}
      >
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={`segment ${option}`}
            aria-pressed={vote === option}
            onClick={() => onVote(member.id, vote === option ? null : option)}
            title={labels[option]}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </article>
  );
}

export default memo(MemberCard);
