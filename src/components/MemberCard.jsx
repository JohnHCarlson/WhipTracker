import "./MemberCard.css";
import { voteLabels, voteOrder } from "../constants";

function MemberCard({ member, isSelected, toggleSelection, changeVote, clearVote }) {
  return (
    <article key={member.id} className={isSelected ? "member-card selected" : "member-card"}>
      <div className="member-top">
        <img src={member.photo} alt={member.name} />
        <div className="member-info">
          <h3>{member.name}</h3>
          <div className="member-meta">
            <span className="member-district">{member.district}</span>
            <span className={member.party === "D" ? "tag party blue" : "tag party red"}>{member.party}</span>
          </div>
        </div>
        <label className="checkbox-pill" aria-label={`Select ${member.name}`}>
          <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(member.id)} />
          <span></span>
        </label>
      </div>

      <div className="tag-row">
        {member.groups.map((group) => (
          <span className="tag affiliation-tag" key={group}>
            {group}
          </span>
        ))}
      </div>

      <div className="vote-row">
        {voteOrder.map((vote) => (
          <button
            key={vote}
            className={`${member.vote === vote ? "vote-pill active" : "vote-pill"} vote-pill-${vote}`}
            onClick={() => (member.vote === vote ? clearVote(member.id) : changeVote(member.id, vote))}
          >
            {voteLabels[vote]}
          </button>
        ))}
      </div>
    </article>
  );
}

export default MemberCard;
