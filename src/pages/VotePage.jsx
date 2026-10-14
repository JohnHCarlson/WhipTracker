import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppHeader, { MiniTally } from "../components/AppHeader";
import { ConfirmDialog } from "../components/Dialog";
import FilterPanel from "../components/FilterPanel";
import { ChevronLeft, Close, Copy, Eye, Filter, More, People, Redo, Reset, Search, SignOut, Trash, Undo, Warning, WifiOff } from "../components/Icons";
import MemberCard from "../components/MemberCard";
import Menu from "../components/Menu";
import SelectionBar, { shortcutsFor } from "../components/SelectionBar";
import ShareDialog from "../components/ShareDialog";
import TallyPanel from "../components/TallyPanel";
import Toast from "../components/Toast";
import { ASSOCIATIONS, PARTIES, STATE_NAMES } from "../constants";
import { memberIds, members } from "../data/roster";
import { canEdit, canManage, PERMISSION_LABEL, TITLE_MAX } from "../lib/access";
import { createVote, deleteVote, errorMessage, unshareVote, useUser } from "../lib/api";
import { EMPTY_FILTERS, FACETS, filterMembers, hasActiveFilters, toggleFilterValue } from "../lib/filters";
import { Link, navigate } from "../lib/router";
import { formatAgo, useNow } from "../lib/time";
import { useVoteHistory } from "../lib/useVoteHistory";
import { clearError, closeVote, openVote, setPositions, updateSettings, useOpenVote } from "../lib/voteStore";
import { computeTally, effectiveVote, getVoteType, isEligible, resolveLabels } from "../lib/voteTypes";
import "./VotePage.css";

const NO_NAMES = [];
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";

// Positions for anyone no longer on the roster (or from the old test roster) are ignored.
const knownVotes = (votes) => Object.fromEntries(Object.entries(votes).filter(([id]) => memberIds.has(id)));

function tokenLabel(facet, value, labels) {
  if (facet === "position") return labels[value];
  if (facet === "party") return PARTIES[value]?.name ?? value;
  if (facet === "state") return STATE_NAMES[value] ?? value;
  if (facet === "association") return ASSOCIATIONS[value] ?? value;
  return value;
}

/** The vote's name, edited in place by anyone who can edit the vote. */
function VoteTitle({ title, editable }) {
  const [draft, setDraft] = useState(title);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  if (!editable) return <h1 className="vote-title">{title}</h1>;

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) updateSettings({ title: next });
    else setDraft(title);
  };

  return (
    <h1 className="vote-title">
      <input
        className="vote-title-input"
        value={draft}
        maxLength={TITLE_MAX}
        aria-label="Vote name"
        title="Rename"
        size={Math.max(4, draft.length)}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(title);
            setEditing(false);
            requestAnimationFrame(() => e.target.blur());
          }
        }}
      />
    </h1>
  );
}

function SaveStatus({ pending, offline }) {
  if (offline)
    return (
      <span className="save-status warning" role="status">
        <WifiOff width={16} height={16} />
        Offline, {pending} {pending === 1 ? "change" : "changes"} waiting
      </span>
    );
  return (
    <span className="save-status" role="status">
      {pending > 0 ? "Saving…" : "Saved"}
    </span>
  );
}

/** Says plainly when the live connection is down, so nobody trusts a stale count. */
function ConnectionBanner({ connection }) {
  // A blip of a second or two (a restart, a phone switching networks) isn't worth a banner.
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (connection !== "reconnecting") return setShow(false);
    const timer = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(timer);
  }, [connection]);
  if (!show) return null;
  return (
    <div className="notice warning" role="status">
      <WifiOff width={18} height={18} />
      <p>
        <strong>Lost the connection to the server.</strong> Reconnecting… Other people’s changes won’t show until it’s back.
      </p>
    </div>
  );
}

function Shell({ theme, onToggleTheme, children }) {
  return (
    <div className="app">
      <AppHeader theme={theme} onToggleTheme={onToggleTheme} />
      <main className="page">{children}</main>
    </div>
  );
}

/** One saved vote, at /v/<id>. */
function VotePage({ id, theme, onToggleTheme }) {
  useEffect(() => {
    openVote(id);
    return () => closeVote();
  }, [id]);
  const open = useOpenVote();

  if (open.id !== id || open.status === "loading" || !open.vote) {
    if (open.status === "missing" || open.status === "deleted")
      return (
        <Shell theme={theme} onToggleTheme={onToggleTheme}>
          <div className="empty card">
            <p className="empty-title">{open.status === "deleted" ? `${open.deletedBy ?? "Someone"} deleted this vote` : "This vote isn’t here"}</p>
            <p className="empty-body">
              {open.status === "deleted" ? "It’s gone for everyone." : "It may have been deleted, or it isn’t shared with you anymore."}
            </p>
            <Link to="/" className="button">
              All votes
            </Link>
          </div>
        </Shell>
      );
    return (
      <Shell theme={theme} onToggleTheme={onToggleTheme}>
        <p className="results-note">Loading…</p>
      </Shell>
    );
  }
  // Keyed by vote, so undo history and selection start fresh for each one.
  return <Workspace key={id} open={open} theme={theme} onToggleTheme={onToggleTheme} />;
}

function Workspace({ open, theme, onToggleTheme }) {
  const { vote } = open;
  const me = useUser();
  const now = useNow();
  const editable = canEdit(vote.access);
  const manage = canManage(vote.access);

  const votes = useMemo(() => knownVotes(vote.positions), [vote.positions]);
  const { setVotes, clearAll, undo, redo, canUndo, canRedo } = useVoteHistory(votes, setPositions);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [tallyInView, setTallyInView] = useState(true);
  const tallyRef = useRef(null);
  const searchRef = useRef(null);
  const anchorRef = useRef(null);
  const autoSelectRef = useRef(false);

  const type = getVoteType(vote.voteType);
  const delegatesVote = vote.delegatesVote;
  const names = vote.candidates?.[type.id] ?? NO_NAMES;
  const labels = useMemo(() => resolveLabels(type, names), [type, names]);
  const shortcuts = shortcutsFor(type);
  const shortcutVotes = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(shortcuts).map(([position, key]) => [key.toLowerCase(), position === "undecided" ? null : position]),
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
  // Otherwise, the selection never includes members you can't see. Viewers don't select.
  useEffect(() => {
    if (autoSelectRef.current) {
      autoSelectRef.current = false;
      anchorRef.current = null;
      const facetActive = FACETS.some((facet) => filters[facet].length > 0);
      setSelected(facetActive && editable ? new Set(visible.map((member) => member.id)) : new Set());
      return;
    }
    const visibleIds = new Set(visible.map((member) => member.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visible, editable]);

  // Losing edit access mid-session (the owner changed the sharing) drops the selection.
  useEffect(() => {
    if (!editable) setSelected(new Set());
  }, [editable]);

  useEffect(() => {
    document.title = `${vote.title} · Whip Tracker`;
    return () => {
      document.title = "Whip Tracker";
    };
  }, [vote.title]);

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
    (memberId, position) => {
      setVotes([memberId], position);
      setToast(null); // its Undo would now undo this change instead
    },
    [setVotes],
  );

  const toggleSelect = useCallback((memberId, extend) => {
    setSelected((current) => {
      const next = new Set(current);
      const ids = visibleRef.current.map((member) => member.id);
      const anchor = anchorRef.current;
      if (extend && anchor != null && ids.includes(anchor)) {
        const [from, to] = [ids.indexOf(anchor), ids.indexOf(memberId)].sort((a, b) => a - b);
        ids.slice(from, to + 1).forEach((rangeId) => next.add(rangeId));
      } else if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
    anchorRef.current = memberId;
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(visibleRef.current.map((member) => member.id))), []);
  const deselectAll = useCallback(() => {
    setSelected(new Set());
    anchorRef.current = null;
  }, []);

  // Setting a position finishes the job: votes change, then filters and selection reset so
  // the next filter click starts a fresh group instead of stacking on the last one.
  const applyToSelection = useCallback(
    (position) => {
      if (selected.size === 0) return;
      const ids = [...selected];
      setVotes(ids, position);
      const label = position ? labels[position] : labels.undecided;
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
  const setCandidateNamesForType = (next) => updateSettings({ candidates: { [type.id]: next } });

  // The key handler reads state through a ref so a shortcut pressed right after a filter
  // click sees that click's selection, not the one from before the re-render.
  const keyState = useRef(null);
  keyState.current = { selected, sheetOpen, labels, shortcutVotes, applyToSelection, editable };

  useEffect(() => {
    const onKey = (event) => {
      const { selected, sheetOpen, labels, shortcutVotes, applyToSelection, editable } = keyState.current;
      // A dialog (sharing, deleting) has the keyboard to itself.
      if (document.querySelector("dialog[open]")) return;
      const typing = event.target.closest?.("input, textarea, select, [contenteditable='true']");
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === "z" && !typing && editable) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y" && !typing && editable) {
        event.preventDefault();
        redo();
        return;
      }
      if (typing) {
        if (event.key === "Escape") event.target.blur();
        return;
      }
      if (mod && key === "a" && editable) {
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
      if (editable && !mod && !event.altKey && selected.size > 0 && key in shortcutVotes) {
        const position = shortcutVotes[key];
        if (position && !labels[position]) return;
        event.preventDefault();
        applyToSelection(position);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectAll, deselectAll]);

  const sharedVote = useMemo(() => {
    const positions = new Set([...selected].map((memberId) => effectiveVote(votes[memberId], type)));
    return positions.size === 1 ? [...positions][0] : undefined;
  }, [selected, votes, type]);

  const run = async (fn) => {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };
  const duplicate = () =>
    run(async () => {
      const copy = await createVote({ title: `${vote.title} (copy)`.slice(0, TITLE_MAX), copyFrom: vote.id });
      navigate(`/v/${copy.id}`);
    });

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

  const editor = vote.updatedBy.id === me?.id ? "you" : vote.updatedBy.name;
  const owner = vote.access === "owner" ? "Yours" : `${vote.ownerName}’s`;
  const yourAccess = vote.access === "edit" || vote.access === "view" ? ` · Shared with you: ${PERMISSION_LABEL[vote.access].toLowerCase()}` : "";

  return (
    <div className={`app${selected.size > 0 ? " has-selection" : ""}`}>
      <AppHeader
        theme={theme}
        onToggleTheme={onToggleTheme}
        center={<MiniTally tally={tally} type={type} labels={labels} shown={!tallyInView} />}
        actions={
          editable && (
            <>
              <button type="button" className="icon-button" onClick={undo} disabled={!canUndo} aria-label="Undo" title={`Undo (${mod}Z)`}>
                <Undo />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
                title={`Redo (${isMac ? "⇧⌘Z" : "Ctrl+Y"})`}
              >
                <Redo />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={resetAll}
                disabled={Object.keys(votes).length === 0}
                aria-label="Clear all positions"
                title="Clear all positions"
              >
                <Reset />
              </button>
            </>
          )
        }
      />

      <main className="page">
        <div className="vote-bar">
          <Link to="/" className="back-link">
            <ChevronLeft width={16} height={16} />
            All votes
          </Link>
          <div className="vote-bar-main">
            <VoteTitle title={vote.title} editable={editable} />
            <div className="vote-bar-actions">
              {editable ? (
                <SaveStatus pending={open.pending} offline={open.offline} />
              ) : (
                <span className="view-only">
                  <Eye width={16} height={16} />
                  View only
                </span>
              )}
              {manage && (
                <button type="button" className="button share-button" onClick={() => setSharing(true)}>
                  <People width={18} height={18} />
                  Share
                  {vote.shares.length > 0 && <span className="share-count">{vote.shares.length}</span>}
                </button>
              )}
              <Menu
                label="More"
                icon={<More />}
                items={[
                  { label: "Duplicate", icon: <Copy />, onSelect: duplicate },
                  !manage && {
                    label: "Remove from my list",
                    icon: <SignOut />,
                    onSelect: () =>
                      run(async () => {
                        await unshareVote(vote.id, me.id);
                        navigate("/");
                      }),
                  },
                  manage && { label: "Delete…", icon: <Trash />, danger: true, onSelect: () => setDeleting(true) },
                ]}
              />
            </div>
          </div>
          <p className="vote-bar-meta">
            {owner}
            {yourAccess} · Edited {formatAgo(vote.updatedAt, Math.max(now, Date.parse(vote.updatedAt)))} by {editor}
          </p>
        </div>

        <ConnectionBanner connection={open.connection} />
        {(open.error || actionError) && (
          <div className="notice error" role="alert">
            <Warning width={18} height={18} />
            <p>
              <strong>That didn’t save.</strong> {open.error ?? actionError}
            </p>
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss"
              onClick={() => {
                clearError();
                setActionError(null);
              }}
            >
              <Close width={16} height={16} />
            </button>
          </div>
        )}

        <TallyPanel
          ref={tallyRef}
          tally={tally}
          type={type}
          labels={labels}
          readOnly={!editable}
          onTypeChange={(voteType) => updateSettings({ voteType })}
          delegatesVote={delegatesVote}
          onDelegatesVoteChange={(value) => updateSettings({ delegatesVote: value })}
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
                {visible.length === eligible.length ? `${eligible.length} members` : `${visible.length} of ${eligible.length} members`}
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
              {editable && visible.length > 0 && (
                <button type="button" className="link-button select-all" onClick={allSelected ? deselectAll : selectAll}>
                  {allSelected ? "Deselect All" : visible.length === eligible.length ? "Select All" : `Select ${visible.length}`}
                </button>
              )}
            </div>

            {hiddenCount > 0 && (
              <p className="results-note">{hiddenCount} non-voting delegates are hidden because they can't vote on this question.</p>
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
                    readOnly={!editable}
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
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Filters" onClick={(event) => event.stopPropagation()}>
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
        {editable && selected.size > 0 && (
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

      <ShareDialog vote={vote} open={sharing} onClose={() => setSharing(false)} />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete “${vote.title}”?`}
        description={
          vote.shares.length
            ? `It’s gone for everyone, including the ${vote.shares.length} ${vote.shares.length === 1 ? "person" : "people"} it’s shared with.`
            : "It’s gone for good."
        }
        confirmLabel="Delete"
        onConfirm={() =>
          run(async () => {
            await deleteVote(vote.id);
            navigate("/", { replace: true });
          })
        }
      />
    </div>
  );
}

export default VotePage;
