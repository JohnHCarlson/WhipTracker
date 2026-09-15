import { useEffect, useMemo, useState } from "react";
import initialMembers from "./data/members.json";
import FiltersPanel from "./components/FiltersPanel";
import MemberCard from "./components/MemberCard";
import SummaryPanel from "./components/SummaryPanel";
import { groupOptions, STORAGE_KEY } from "./constants";
import { buildSummary, filterMembers, getStateOptions, loadMembers } from "./utils/whipUtils";

function App() {
  const [members, setMembers] = useState(() => loadMembers(initialMembers));
  const [partyFilter, setPartyFilter] = useState("all");
  const [groupFilters, setGroupFilters] = useState([]);
  const [stateFilters, setStateFilters] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [voteType, setVoteType] = useState("simple-majority");

  useEffect(() => {
    setSelectedIds([]);
  }, [partyFilter, groupFilters, stateFilters]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  }, [members]);

  const stateOptions = useMemo(() => getStateOptions(members), [members]);

  const filteredMembers = useMemo(() => filterMembers(members, partyFilter, groupFilters, stateFilters), [members, partyFilter, groupFilters, stateFilters]);

  const summary = useMemo(() => buildSummary(members, voteType), [members, voteType]);

  const activeCount = filteredMembers.length;

  const toggleSelection = (id) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const changeVote = (id, vote) => {
    setMembers((current) => current.map((member) => (member.id === id ? { ...member, vote } : member)));
  };

  const bulkChangeVote = (vote) => {
    setMembers((current) => current.map((member) => (selectedIds.includes(member.id) ? { ...member, vote } : member)));
  };

  const clearVote = (id) => {
    setMembers((current) => current.map((member) => (member.id === id ? { ...member, vote: null } : member)));
  };

  const selectAllVisible = () => {
    setSelectedIds(filteredMembers.map((member) => member.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const clearFilters = () => {
    setPartyFilter("all");
    setStateFilters([]);
    setGroupFilters([]);
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Congressional whip tracking</p>
          <h1>House floor whip board</h1>
          <p className="subtext">Track vote posture, filter by caucus or party, and move members in bulk.</p>
        </div>
        <div className="hero-stats">
          <div className="hero-card hero-card-stack">
            <div>
              <p className="hero-card-label">Total voting members</p>
              <strong>{summary.total}</strong>
            </div>
          </div>
          <div className="hero-card hero-card-stack">
            <div>
              <p className="hero-card-label">Votes needed to pass</p>
              <strong>{summary.yesNeeded}</strong>
              <p className="hero-card-subtext">based on current rule</p>
            </div>
          </div>
          <div className={summary.passed ? "pass-pill passed" : "pass-pill failed"}>{summary.passed ? "Passed" : "Not passed"}</div>
        </div>
      </header>

      <SummaryPanel summary={summary} voteType={voteType} setVoteType={setVoteType} />

      <FiltersPanel
        partyFilter={partyFilter}
        setPartyFilter={setPartyFilter}
        stateOptions={stateOptions}
        stateFilters={stateFilters}
        setStateFilters={setStateFilters}
        groupOptions={groupOptions}
        groupFilters={groupFilters}
        setGroupFilters={setGroupFilters}
        clearFilters={clearFilters}
        selectedIds={selectedIds}
        activeCount={activeCount}
        selectAllVisible={selectAllVisible}
        clearSelection={clearSelection}
        bulkChangeVote={bulkChangeVote}
      />

      <section className="member-grid">
        {filteredMembers.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            isSelected={selectedIds.includes(member.id)}
            toggleSelection={toggleSelection}
            changeVote={changeVote}
            clearVote={clearVote}
          />
        ))}
      </section>
    </div>
  );
}

export default App;
