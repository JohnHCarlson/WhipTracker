import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import Dialog, { ConfirmDialog } from "../components/Dialog";
import { Copy, People, Plus, Search, SignOut, Trash, More } from "../components/Icons";
import Menu from "../components/Menu";
import ProgressBar from "../components/ProgressBar";
import ShareDialog from "../components/ShareDialog";
import { StatusPill } from "../components/TallyPanel";
import { VOTE_OPTIONS } from "../constants";
import { memberIds, members } from "../data/roster";
import { canManage, PERMISSION_LABEL, TITLE_MAX } from "../lib/access";
import { createVote, deleteVote, errorMessage, listVotes, unshareVote, useUser } from "../lib/api";
import { Link, navigate } from "../lib/router";
import { browserVote, markBrowserVoteHandled } from "../lib/storage";
import { formatAgo, useNow } from "../lib/time";
import { computeTally, getVoteType, isEligible, resolveLabels, VOTE_TYPES } from "../lib/voteTypes";
import "./VoteListPage.css";

// Positions for anyone no longer on the roster are ignored, as on the vote itself.
const known = (positions) => Object.fromEntries(Object.entries(positions).filter(([id]) => memberIds.has(id)));

function summarize(vote) {
  const type = getVoteType(vote.voteType);
  const labels = resolveLabels(type, vote.candidates?.[type.id] ?? []);
  const options = { delegatesVote: vote.delegatesVote };
  const eligible = members.filter((member) => isEligible(member, type, options));
  return { type, labels, tally: computeTally(eligible, known(vote.positions), type, options) };
}

function VoteCard({ vote, me, now, onShare, onDuplicate, onDelete, onLeave }) {
  const { type, labels, tally } = useMemo(() => summarize(vote), [vote]);
  const manage = canManage(vote.access);
  const editor = vote.updatedBy.id === me.id ? "you" : vote.updatedBy.name;
  const whose =
    vote.access === "owner"
      ? vote.shares.length
        ? `Shared with ${vote.shares.length} ${vote.shares.length === 1 ? "person" : "people"}`
        : "Only you"
      : vote.access === "admin"
        ? `${vote.ownerName}’s`
        : `${vote.ownerName}’s · ${PERMISSION_LABEL[vote.access]}`;

  return (
    <article className="vote-card card">
      <div className="vote-card-head">
        <h3 className="vote-card-title">
          <Link to={`/v/${vote.id}`} className="vote-card-link">
            {vote.title}
          </Link>
        </h3>
        <Menu
          label={`More for ${vote.title}`}
          icon={<More />}
          items={[
            manage && { label: "Share…", icon: <People />, onSelect: () => onShare(vote) },
            { label: "Duplicate", icon: <Copy />, onSelect: () => onDuplicate(vote) },
            !manage && { label: "Remove from my list", icon: <SignOut />, onSelect: () => onLeave(vote) },
            manage && { label: "Delete…", icon: <Trash />, danger: true, onSelect: () => onDelete(vote) },
          ]}
        />
      </div>
      <p className="vote-card-type">{type.name}</p>
      <div className="vote-card-tally">
        <ProgressBar tally={tally} type={type} labels={labels} compact />
        <span className="vote-card-score">
          {tally.counts.yes}
          <span className="vote-card-of">/{tally.needed}</span>
        </span>
      </div>
      <StatusPill tally={tally} type={type} labels={labels} compact />
      <p className="vote-card-meta">
        <span>{whose}</span>
        <span>
          Edited {formatAgo(vote.updatedAt, Math.max(now, Date.parse(vote.updatedAt)))} by {editor}
        </span>
      </p>
    </article>
  );
}

function NewVoteDialog({ open, onClose }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const vote = await createVote({ title });
      onClose();
      navigate(`/v/${vote.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New vote" description="You can change the vote type and share it once it’s open.">
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="input"
            required
            autoFocus
            maxLength={TITLE_MAX}
            placeholder="H.R. 1, Election of Speaker 2027…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={busy || !title.trim()}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** The browser's old count, cleaned up for the server: today's members, real positions and vote types only. */
function cleanBrowserVote(data) {
  const type = VOTE_TYPES.find((t) => t.id === data.voteType) ?? getVoteType("passage");
  const candidates = {};
  for (const t of VOTE_TYPES) {
    const names = data.candidates?.[t.id];
    if (t.candidates && Array.isArray(names)) candidates[t.id] = names.slice(0, 3).map((name) => String(name ?? "").slice(0, 24));
  }
  const positions = Object.fromEntries(
    Object.entries(data.positions).filter(([id, position]) => memberIds.has(id) && VOTE_OPTIONS.includes(position)),
  );
  return { voteType: type.id, delegatesVote: Boolean(data.delegatesVote), candidates, positions };
}

function BrowserVoteBanner({ data, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const clean = useMemo(() => cleanBrowserVote(data), [data]);
  const count = Object.keys(clean.positions).length;
  if (!count) return null;

  const save = async () => {
    setBusy(true);
    try {
      const vote = await createVote({ title: "Saved in this browser", data: clean });
      markBrowserVoteHandled();
      navigate(`/v/${vote.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="browser-vote card" role="status">
      <div className="browser-vote-text">
        <p className="browser-vote-title">This browser has a count from before votes were saved to accounts</p>
        <p className="browser-vote-body">
          {count} {count === 1 ? "position" : "positions"}, {getVoteType(clean.voteType).name}. Save it as a vote to keep it and share it.
        </p>
        {error && <p className="form-error">{error}</p>}
      </div>
      <div className="browser-vote-actions">
        <button
          type="button"
          className="button"
          onClick={() => {
            markBrowserVoteHandled();
            onDone();
          }}
        >
          Not now
        </button>
        <button type="button" className="button primary" onClick={save} disabled={busy}>
          Save as a vote
        </button>
      </div>
    </div>
  );
}

function Section({ title, note, votes, ...cardProps }) {
  if (!votes.length) return null;
  return (
    <section className="vote-section" aria-label={title}>
      <div className="vote-section-head">
        <h2 className="vote-section-title">
          {title} <span className="vote-section-count">{votes.length}</span>
        </h2>
        {note && <p className="vote-section-note">{note}</p>}
      </div>
      <div className="vote-grid">
        {votes.map((vote) => (
          <VoteCard key={vote.id} vote={vote} {...cardProps} />
        ))}
      </div>
    </section>
  );
}

/** The front page: every vote you can open, yours first. */
function VoteListPage({ theme, onToggleTheme }) {
  const me = useUser();
  const now = useNow();
  const [votes, setVotes] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [legacy, setLegacy] = useState(browserVote);

  const reload = useCallback(() => listVotes().then(setVotes, (e) => setError(errorMessage(e))), []);

  // Loaded on arrival, and again when coming back to the tab, since others may have shared or changed something.
  useEffect(() => {
    void reload();
    const onVisible = () => document.visibilityState === "visible" && void reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const act = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
    await reload();
  };

  const duplicate = (vote) =>
    act(async () => {
      const copy = await createVote({ title: `${vote.title} (copy)`.slice(0, TITLE_MAX), copyFrom: vote.id });
      navigate(`/v/${copy.id}`);
    });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (votes ?? []).filter((vote) => !q || vote.title.toLowerCase().includes(q) || vote.ownerName.toLowerCase().includes(q));
  }, [votes, query]);

  const cardProps = {
    me,
    now,
    onShare: setSharing,
    onDuplicate: duplicate,
    onDelete: setDeleting,
    onLeave: (vote) => act(() => unshareVote(vote.id, me.id)),
  };

  return (
    <div className="app">
      <AppHeader theme={theme} onToggleTheme={onToggleTheme} />
      <main className="page list-page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Votes</h1>
            <p className="page-subtitle">Each one is a saved count you can come back to and share.</p>
          </div>
          <button type="button" className="button primary" onClick={() => setCreating(true)}>
            <Plus width={18} height={18} />
            New vote
          </button>
        </div>

        {legacy && <BrowserVoteBanner data={legacy} onDone={() => setLegacy(null)} />}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {votes && votes.length > 6 && (
          <label className="search list-search">
            <Search width={17} height={17} />
            <input type="search" placeholder="Search votes" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search votes" />
          </label>
        )}

        {votes && votes.length === 0 && (
          <div className="empty card">
            <p className="empty-title">No votes yet</p>
            <p className="empty-body">Make one for each bill or question you’re counting. Votes others share with you show up here too.</p>
            <button type="button" className="button primary" onClick={() => setCreating(true)}>
              <Plus width={18} height={18} />
              New vote
            </button>
          </div>
        )}
        {votes && votes.length > 0 && shown.length === 0 && <p className="results-note">No votes match “{query}”.</p>}

        <Section title="Yours" votes={shown.filter((vote) => vote.access === "owner")} {...cardProps} />
        <Section title="Shared with you" votes={shown.filter((vote) => vote.access === "edit" || vote.access === "view")} {...cardProps} />
        <Section
          title="Everyone else’s"
          note="You can see and change these because you’re an admin."
          votes={shown.filter((vote) => vote.access === "admin")}
          {...cardProps}
        />
      </main>

      <NewVoteDialog open={creating} onClose={() => setCreating(false)} />
      <ShareDialog vote={sharing} open={sharing != null} onClose={() => setSharing(null)} onChanged={() => void reload()} />
      <ConfirmDialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.title}”?`}
        description={
          deleting?.shares.length
            ? `It’s gone for everyone, including the ${deleting.shares.length} ${deleting.shares.length === 1 ? "person" : "people"} it’s shared with.`
            : "It’s gone for good."
        }
        confirmLabel="Delete"
        onConfirm={() => deleting && act(() => deleteVote(deleting.id))}
      />
    </div>
  );
}

export default VoteListPage;
