import { useEffect, useState } from "react";
import { isAdmin, PERMISSION_LABEL } from "../lib/access";
import { errorMessage, listDirectory, shareVote, unshareVote, useUser } from "../lib/api";
import Dialog from "./Dialog";
import { Close } from "./Icons";
import "./ShareDialog.css";

/**
 * Who a vote is shared with, and what each person can do with it. Changes save right
 * away. Only people who can use the Whip Tracker can be added; admins add new people
 * on the People page.
 */
function ShareDialog({ vote, open, onClose, onChanged }) {
  const me = useUser();
  const [directory, setDirectory] = useState(null);
  const [shares, setShares] = useState(vote?.shares ?? []);
  const [adding, setAdding] = useState("");
  const [permission, setPermission] = useState("edit");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const voteId = vote?.id;
  useEffect(() => {
    if (!open || !voteId) return;
    setError(null);
    listDirectory().then(setDirectory, (e) => setError(errorMessage(e)));
  }, [open, voteId]);
  // Someone else may change the sharing while this is open; the vote brings their changes.
  useEffect(() => {
    if (vote?.shares) setShares(vote.shares);
  }, [vote?.shares]);

  if (!vote) return null;

  const byId = new Map((directory ?? []).map((person) => [person.id, person]));
  const sharedIds = new Set(shares.map((share) => share.personId));
  const choices = (directory ?? []).filter((person) => person.id !== vote.ownerId && !sharedIds.has(person.id));

  const act = async (fn) => {
    setError(null);
    setBusy(true);
    try {
      const updated = await fn();
      setShares(updated.shares);
      onChanged?.(updated);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (event) => {
    event.preventDefault();
    if (!adding) return;
    if (await act(() => shareVote(vote.id, Number(adding), permission))) setAdding("");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={`Share “${vote.title}”`}
      description="People you add find it in their list of votes. Admins can see every vote."
    >
      <form className="share-add" onSubmit={add}>
        <select className="select share-person" value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Person to add" disabled={!directory}>
          <option value="">{directory ? (choices.length ? "Choose a person…" : "Everyone already has it") : "Loading people…"}</option>
          {choices.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} ({person.email})
            </option>
          ))}
        </select>
        <select className="select" value={permission} onChange={(e) => setPermission(e.target.value)} aria-label="What they can do">
          <option value="edit">{PERMISSION_LABEL.edit}</option>
          <option value="view">{PERMISSION_LABEL.view}</option>
        </select>
        <button type="submit" className="button primary" disabled={!adding || busy}>
          Add
        </button>
      </form>
      {directory && choices.length === 0 && (
        <p className="form-note">
          {isAdmin(me) || me?.owner ? "To share with someone new, add them on the People page first." : "To share with someone new, ask an admin to add them."}
        </p>
      )}

      <ul className="share-list" aria-label="People with access">
        <li className="share-row">
          <div className="share-who">
            <span className="share-name">
              {vote.ownerName}
              {vote.ownerId === me?.id && <span className="share-you"> (you)</span>}
            </span>
            {byId.get(vote.ownerId) && <span className="share-email">{byId.get(vote.ownerId).email}</span>}
          </div>
          <span className="share-role">Owner</span>
        </li>
        {shares.map((share) => {
          const person = byId.get(share.personId);
          return (
            <li className="share-row" key={share.personId}>
              <div className="share-who">
                <span className="share-name">
                  {share.name}
                  {share.personId === me?.id && <span className="share-you"> (you)</span>}
                </span>
                {person ? <span className="share-email">{person.email}</span> : directory && <span className="share-email">Can’t use the Whip Tracker anymore</span>}
              </div>
              <select
                className="select compact"
                value={share.permission}
                disabled={busy}
                onChange={(e) => void act(() => shareVote(vote.id, share.personId, e.target.value))}
                aria-label={`What ${share.name} can do`}
              >
                <option value="edit">{PERMISSION_LABEL.edit}</option>
                <option value="view">{PERMISSION_LABEL.view}</option>
              </select>
              <button
                type="button"
                className="icon-button"
                disabled={busy}
                onClick={() => void act(() => unshareVote(vote.id, share.personId))}
                aria-label={`Stop sharing with ${share.name}`}
                title="Stop sharing"
              >
                <Close width={16} height={16} />
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  );
}

export default ShareDialog;
