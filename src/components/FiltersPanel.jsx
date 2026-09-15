import "./FiltersPanel.css";

function FiltersPanel({
  partyFilter,
  setPartyFilter,
  stateOptions,
  stateFilters,
  setStateFilters,
  groupOptions,
  groupFilters,
  setGroupFilters,
  clearFilters,
  selectedIds,
  activeCount,
  selectAllVisible,
  clearSelection,
  bulkChangeVote,
}) {
  return (
    <section className="controls-panel">
      <div className="control-block">
        <h2>Filters</h2>
        <div className="chip-row">
          <button className={partyFilter === "all" ? "chip active" : "chip"} onClick={() => setPartyFilter("all")}>
            All parties
          </button>
          <button className={partyFilter === "D" ? "chip active" : "chip"} onClick={() => setPartyFilter("D")}>
            Democrats
          </button>
          <button className={partyFilter === "R" ? "chip active" : "chip"} onClick={() => setPartyFilter("R")}>
            Republicans
          </button>
          <button className={partyFilter === "I" ? "chip active" : "chip"} onClick={() => setPartyFilter("I")}>
            Independent
          </button>
        </div>
        <div className="filter-select-row">
          <label className="filter-select">
            <span>State</span>
            <select
              multiple
              size={Math.min(stateOptions.length + 1, 6)}
              value={stateFilters}
              onChange={(event) => {
                setStateFilters(Array.from(event.target.selectedOptions, (option) => option.value));
              }}
            >
              {stateOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-select">
            <span>Caucus</span>
            <select
              multiple
              size={Math.min(groupOptions.length + 1, 6)}
              value={groupFilters}
              onChange={(event) => {
                setGroupFilters(Array.from(event.target.selectedOptions, (option) => option.value));
              }}
            >
              {groupOptions.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="secondary clear-filters" onClick={clearFilters}>
          Clear filters
        </button>
      </div>

      <div className="control-block">
        <h2>Bulk actions</h2>
        <div className="button-row">
          <button className="secondary" onClick={selectAllVisible}>
            Select all
          </button>
          <button className="secondary" onClick={clearSelection}>
            Clear selection
          </button>
        </div>
        <div className="button-row">
          <button onClick={() => bulkChangeVote("yes")}>Move selected to Yes</button>
          <button onClick={() => bulkChangeVote("no")}>Move selected to No</button>
          <button onClick={() => bulkChangeVote("present")}>Move selected to Present</button>
          <button onClick={() => bulkChangeVote(null)}>Move selected to No vote</button>
        </div>
        <p className="helper-text">
          {selectedIds.length} selected out of {activeCount} visible members
        </p>
      </div>
    </section>
  );
}

export default FiltersPanel;
