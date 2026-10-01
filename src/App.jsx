import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import members from "./data/members.json";
import AppHeader from "./components/AppHeader";
import FilterPanel from "./components/FilterPanel";
import MemberCard from "./components/MemberCard";
import SelectionBar, { shortcutsFor } from "./components/SelectionBar";
import TallyPanel from "./components/TallyPanel";
import Toast from "./components/Toast";
import { Close, Filter, Search } from "./components/Icons";
import { PARTIES, STATE_NAMES } from "./constants";
import { EMPTY_FILTERS, FACETS, filterMembers, hasActiveFilters, toggleFilterValue } from "./lib/filters";
import { loadSaved, save } from "./lib/storage";
import { useVoteHistory } from "./lib/useVoteHistory";
import {
  DEFAULT_VOTE_TYPE_ID,
  computeTally,
  effectiveVote,
  getVoteType,
  isEligible,
  resolveLabels,
} from "./lib/voteTypes";

const NO_NAMES = [];

function tokenLabel(facet, value, labels) {
  if (facet === "position") return labels[value];
  if (facet === "party") return PARTIES[value]?.name ?? value;
  if (facet === "state") return STATE_NAMES[value] ?? value;
  return value;
}

function App() {
  const [saved] = useState(loadSaved);
  const { votes, setVotes, clearAll, undo, redo, canUndo, canRedo } = useVoteHistory(saved.votes);
  const [voteTypeId, setVoteTypeId] = useState(saved.settings.voteType ?? DEFAULT_VOTE_TYPE_ID);
  const [delegatesVote, setDelegatesVote] = useState(saved.settings.delegatesVote ?? false);
  const [theme, setTheme] = useState(saved.settings.theme ?? "light");
  const [candidateNames, setCandidateNames] = useState(saved.settings.candidates ?? {});
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tallyInView, setTallyInView] = useState(true);
  const tallyRef = useRef(null);
  const searchRef = useRef(null);
  const anchorRef = useRef(null);
  const autoSelectRef = useRef(false);

  const type = getVoteType(voteTypeId);
  const names = candidateNames[type.id] ?? NO_NAMES;
  const labels = useMemo(() => resolveLabels(type, names), [type, names]);
  const shortcuts = shortcutsFor(type);
  const shortcutVotes = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(shortcuts).map(([vote, key]) => [key.toLowerCase(), vote === "undecided" ? null : vote]),
      ),
    [shortcuts],
  );

  const eligible = useMemo(
    () => members.filter((member) => isEligible(member, type, { delegatesVote })),
    [type, delegatesVote],
  );
  const hiddenCount = members.length - eligible.length;
  const tally = useMemo(() => computeTally(eligible, votes, type, { delegatesVote }), [eligible, votes, type, delegatesVote]);

  // When filtering by position, keep matching against the positions as they were when the
  // filter was set (like Mail's Unread view). Otherwise marking a card would make it vanish and
  // slide the next card under the pointer.
  const positionKey = `${type.id}|${filters.position.join(",")}`;
  const filterVotes = useMemo(() => votes, [positionKey]);
  const liveCtx = useMemo(() => ({ votes, type }), [votes, type]);
  const filterCtx = useMemo(() => ({ votes: filterVotes, type }), [filterVotes, type]);

  const visible = useMemo(() => filterMembers(eligible, filters, filterCtx), [eligible, filters, filterCtx]);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // Picking a filter selects everyone it shows, so "CPC + New York, then Yes" is three
  // clicks. Clearing every filter clears the selection rather than selecting the House.
  // Otherwise, the selection never includes members you can't see.
  useEffect(() => {
    if (autoSelectRef.current) {
      autoSelectRef.current = false;
      anchorRef.current = null;
      const facetActive = FACETS.some((facet) => filters[facet].length > 0);
      setSelected(facetActive ? new Set(visible.map((member) => member.id)) : new Set());
      return;
    }
    const visibleIds = new Set(visible.map((member) => member.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visible]);

  useEffect(() => {
    save(votes, { voteType: voteTypeId, delegatesVote, theme, candidates: candidateNames });
  }, [votes, voteTypeId, delegatesVote, theme, candidateNames]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const node = tallyRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => setTallyInView(entry.isIntersecting), {
      rootMargin: "-56px 0px 0px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const showToast = useCallback((message, restore = null) => setToast({ id: Date.now(), message, restore }), []);
  const dismissToast = useCallback(() => setToast(null), []);
  // The toast's Undo also brings back the filters and selection, so a wrong button is one click to fix.
  const undoFromToast = () => {
    undo();
    if (toast?.restore) {
      autoSelectRef.current = false;
      setFilters(toast.restore.filters);
      setSelected(new Set(toast.restore.selection));
    }
  };

  const voteOne = useCallback(
    (id, vote) => {
      setVotes([id], vote);
      setToast(null); // its Undo would now undo this change instead
    },
    [setVotes],
  );

  const toggleSelect = useCallback((id, extend) => {
    setSelected((current) => {
      const next = new Set(current);
      const ids = visibleRef.current.map((member) => member.id);
      const anchor = anchorRef.current;
      if (extend && anchor != null && ids.includes(anchor)) {
        const [from, to] = [ids.indexOf(anchor), ids.indexOf(id)].sort((a, b) => a - b);
        ids.slice(from, to + 1).forEach((rangeId) => next.add(rangeId));
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    anchorRef.current = id;
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(visibleRef.current.map((member) => member.id))), []);
  const deselectAll = useCallback(() => {
    setSelected(new Set());
    anchorRef.current = null;
  }, []);

  // Setting a position finishes the job: votes change, then filters and selection reset so
  // the next filter click starts a fresh group instead of stacking on the last one.
  const applyToSelection = useCallback(
    (vote) => {
      if (selected.size === 0) return;
      const ids = [...selected];
      setVotes(ids, vote);
      const label = vote ? labels[vote] : labels.undecided;
      showToast(`${ids.length} ${ids.length === 1 ? "member" : "members"} set to ${label}`, { selection: ids, filters });
      autoSelectRef.current = false;
      setFilters(EMPTY_FILTERS);
      deselectAll();
    },
    [selected, setVotes, labels, showToast, deselectAll, filters],
  );

  const resetAll = () => {
    clearAll();
    showToast("All positions cleared");
  };

  const changeFilters = (next, { autoSelect = true } = {}) => {
    autoSelectRef.current = autoSelect;
    setFilters(next);
  };
  const toggleFacet = (facet, value) => changeFilters(toggleFilterValue(filters, facet, value));
  const clearFacet = (facet) => changeFilters({ ...filters, [facet]: [] });
  const clearFilters = () => changeFilters(EMPTY_FILTERS);
  const setCandidateNamesForType = (next) => setCandidateNames((current) => ({ ...current, [type.id]: next }));

  useEffect(() => {
    const onKey = (event) => {
      const typing = event.target.closest?.("input, textarea, select, [contenteditable='true']");
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === "z" && !typing) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y" && !typing) {
        event.preventDefault();
        redo();
        return;
      }
      if (typing) {
        if (event.key === "Escape") event.target.blur();
        return;
      }
      if (mod && key === "a") {
        event.preventDefault();
        selectAll();
        return;
      }
      if (event.key === "Escape") {
        if (sheetOpen) setSheetOpen(false);
        else deselectAll();
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (!mod && !event.altKey && selected.size > 0 && key in shortcutVotes) {
        const vote = shortcutVotes[key];
        if (vote && !labels[vote]) return;
        event.preventDefault();
        applyToSelection(vote);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectAll, deselectAll, applyToSelection, selected, sheetOpen, labels, shortcutVotes]);

  const sharedVote = useMemo(() => {
    const positions = new Set([...selected].map((id) => effectiveVote(votes[id], type)));
    return positions.size === 1 ? [...positions][0] : undefined;
  }, [selected, votes, type]);

  const allSelected = visible.length > 0 && selected.size === visible.length;
  const activeTokens = FACETS.flatMap((facet) => filters[facet].map((value) => ({ facet, value })));
  const filterPanel = (
    <FilterPanel
      members={eligible}
      filters={filters}
      ctx={filterCtx}
      countCtx={liveCtx}
      labels={labels}
      onToggle={toggleFacet}
      onClearFacet={clearFacet}
      onClearAll={clearFilters}
    />
  );

  return (
    <div className={`app${selected.size > 0 ? " has-selection" : ""}`}>
      <AppHeader
        tally={tally}
        type={type}
        labels={labels}
        showMiniTally={!tallyInView}
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onReset={resetAll}
        hasVotes={Object.keys(votes).length > 0}
      />

      <main className="page">
        <TallyPanel
          ref={tallyRef}
          tally={tally}
          type={type}
          labels={labels}
          onTypeChange={setVoteTypeId}
          delegatesVote={delegatesVote}
          onDelegatesVoteChange={setDelegatesVote}
          candidateNames={names}
          onCandidateNamesChange={setCandidateNamesForType}
        />

        <div className="layout">
          <aside className="sidebar card" aria-label="Filters">
            {filterPanel}
          </aside>

          <section className="results" aria-label="Members">
            <div className="results-toolbar">
              <label className="search">
                <Search width={17} height={17} />
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Search name, state or district"
                  value={filters.query}
                  onChange={(event) => changeFilters({ ...filters, query: event.target.value }, { autoSelect: false })}
                  aria-label="Search members"
                />
                <kbd className="search-hint">/</kbd>
              </label>
              <button type="button" className="button filters-button" onClick={() => setSheetOpen(true)}>
                <Filter width={18} height={18} />
                Filters
                {activeTokens.length > 0 && <span className="badge">{activeTokens.length}</span>}
              </button>
            </div>

            <div className="results-meta">
              <p className="results-count">
                {visible.length === eligible.length
                  ? `${eligible.length} members`
                  : `${visible.length} of ${eligible.length} members`}
              </p>
              {activeTokens.length > 0 && (
                <ul className="tokens" aria-label="Active filters">
                  {activeTokens.map(({ facet, value }) => (
                    <li key={`${facet}:${value}`}>
                      <button
                        type="button"
                        className="token"
                        onClick={() => toggleFacet(facet, value)}
                        aria-label={`Remove filter ${tokenLabel(facet, value, labels)}`}
                      >
                        {tokenLabel(facet, value, labels)}
                        <Close width={12} height={12} strokeWidth={2.2} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {visible.length > 0 && (
                <button type="button" className="link-button select-all" onClick={allSelected ? deselectAll : selectAll}>
                  {allSelected ? "Deselect All" : visible.length === eligible.length ? "Select All" : `Select ${visible.length}`}
                </button>
              )}
            </div>

            {hiddenCount > 0 && (
              <p className="results-note">
                {hiddenCount} non-voting delegates are hidden because they can't vote on this question.
              </p>
            )}

            {visible.length === 0 ? (
              <div className="empty card">
                <p className="empty-title">No members match</p>
                <p className="empty-body">Try removing a filter or changing your search.</p>
                {hasActiveFilters(filters) && (
                  <button type="button" className="button" onClick={clearFilters}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid">
                {visible.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    vote={effectiveVote(votes[member.id], type)}
                    labels={labels}
                    selected={selected.has(member.id)}
                    selectionActive={selected.size > 0}
                    onToggleSelect={toggleSelect}
                    onVote={voteOne}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {sheetOpen && (
        <div className="sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-body">{filterPanel}</div>
            <div className="sheet-footer">
              <button type="button" className="button primary" onClick={() => setSheetOpen(false)}>
                Show {visible.length} {visible.length === 1 ? "member" : "members"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="floating">
        <Toast toast={toast} onUndo={undoFromToast} onDismiss={dismissToast} />
        {selected.size > 0 && (
          <SelectionBar
            count={selected.size}
            visibleCount={visible.length}
            sharedVote={sharedVote}
            labels={labels}
            shortcuts={shortcuts}
            onVote={applyToSelection}
            onSelectAll={selectAll}
            onDeselect={deselectAll}
          />
        )}
      </div>
    </div>
  );
}

export default App;
