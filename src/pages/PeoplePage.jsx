import { useCallback, useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import Dialog, { ConfirmDialog } from "../components/Dialog";
import { Check, Copy, LinkIcon, More, Plus, Trash } from "../components/Icons";
import Menu from "../components/Menu";
import { INVITE_DAYS, ROLE_HELP, ROLE_LABEL } from "../lib/access";
import { addPerson, deletePerson, errorMessage, listPeople, newInvite, updatePerson, useUser } from "../lib/api";
import { formatAgo, formatDay, useNow } from "../lib/time";
import "./VoteListPage.css";
import "./PeoplePage.css";

// Admins (and the owner): who can sign in, and what each person can use. The accounts
// service decides which apps the viewer manages and checks every change. People get in with
// a one-time link, which the admin copies and sends however they like; nothing is emailed.

const APP_ID = "whip-tracker";
const roleLabel = (appId, role) => (appId === APP_ID ? ROLE_LABEL[role] : null) ?? role.charAt(0).toUpperCase() + role.slice(1);

/** The link goes to this site if they can use it, otherwise to the first app they can. */
function inviteUrl(person, invite, apps) {
  const other = person.access[APP_ID] ? null : apps.find((app) => person.access[app.id]);
  return `${other ? other.url : window.location.origin}/invite/${invite.token}`;
}

function statusText(person, now) {
  if (person.status === "invited") return `Link sent, good until ${formatDay(person.inviteExpires)}`;
  if (person.status === "expired") return "Link expired";
  const seen = Object.values(person.access)
    .map((a) => a.lastSeen)
    .filter(Boolean)
    .sort()
    .at(-1);
  return seen ? `Active, seen ${formatAgo(seen, Math.max(now, Date.parse(seen)))}` : "Active";
}

function AccessPicker({ app, value, disabled, title, onChange, label }) {
  return (
    <label className="person-app" title={title}>
      <span className="person-app-name">{app.name}</span>
      <select className="select compact" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} aria-label={label}>
        <option value="">No access</option>
        {app.roles.map((role) => (
          <option key={role} value={role}>
            {roleLabel(app.id, role)}
          </option>
        ))}
      </select>
    </label>
  );
}

function AddPersonDialog({ open, apps, onClose, onAdded }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [access, setAccess] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setName("");
    // This app is ticked to start with; any other app is a choice.
    setAccess(apps.some((app) => app.id === APP_ID) ? { [APP_ID]: "member" } : {});
    setError(null);
    setBusy(false);
  }, [open, apps]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onAdded(await addPerson({ email, name, access }));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a person"
      description="You’ll get a link to send them for setting a password. Someone who already has an account just gets the access you choose."
    >
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="As it should appear to others" />
        </label>
        <fieldset className="field add-access">
          <legend className="field-label">Can use</legend>
          {apps.map((app) => {
            const on = access[app.id] != null;
            return (
              <div className="add-access-row" key={app.id}>
                <label className="add-access-app">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      setAccess((current) => {
                        const next = { ...current };
                        if (e.target.checked) next[app.id] = app.roles[0];
                        else delete next[app.id];
                        return next;
                      })
                    }
                  />
                  {app.name}
                </label>
                <select
                  className="select compact"
                  value={access[app.id] ?? app.roles[0]}
                  disabled={!on}
                  onChange={(e) => setAccess((current) => ({ ...current, [app.id]: e.target.value }))}
                  aria-label={`Role in ${app.name}`}
                >
                  {app.roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(app.id, role)}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={busy || Object.keys(access).length === 0}>
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function LinkDialog({ result, apps, onClose }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [result]);
  if (!result) return <Dialog open={false} onClose={onClose} title="" />;
  const { person, invite } = result;
  const first = person.name.split(" ")[0];

  if (!invite)
    return (
      <Dialog open onClose={onClose} title={`${first} is all set`} description={`${person.name} already has a password. They can sign in here with ${person.email} and that password.`}>
        <div className="dialog-actions">
          <button type="button" className="button primary" onClick={onClose}>
            Done
          </button>
        </div>
      </Dialog>
    );

  const url = inviteUrl(person, invite, apps);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      document.getElementById("invite-link")?.select();
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={`Send this link to ${first}`}
      description={`It lets ${person.email} set a password and sign in. It works once, until ${formatDay(invite.expires)}. Nothing is emailed; send it however you like.`}
    >
      <div className="invite-link">
        <input id="invite-link" className="input" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Sign-in link" />
        <button type="button" className="button primary" onClick={copy}>
          {copied ? <Check width={18} height={18} /> : <Copy width={18} height={18} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  );
}

function PeoplePage({ theme, onToggleTheme }) {
  const me = useUser();
  const now = useNow();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState(null);
  const [removing, setRemoving] = useState(null);

  const reload = useCallback(() => listPeople().then(setData, (e) => setError(errorMessage(e))), []);
  useEffect(() => {
    void reload();
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

  const apps = data?.apps ?? [];
  const thisApp = apps.find((app) => app.id === APP_ID);

  return (
    <div className="app">
      <AppHeader theme={theme} onToggleTheme={onToggleTheme} />
      <main className="page people-page">
        <div className="page-head">
          <div>
            <h1 className="page-title">People</h1>
            <p className="page-subtitle">
              Who can sign in, and what they can use. One account works on every site it’s given{data?.owner ? "; as the owner, you manage them all" : ""}.
            </p>
          </div>
          <button type="button" className="button primary" onClick={() => setAdding(true)} disabled={!data}>
            <Plus width={18} height={18} />
            Add a person
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {data && (
          <ul className="people card">
            {data.people.map((person) => {
              const self = person.id === me?.id;
              const locked = self ? "You can’t change your own access." : person.owner && !data.owner ? "Only the owner can change the owner’s access." : null;
              return (
                <li key={person.id} className="person">
                  <div className="person-who">
                    <p className="person-name">
                      {person.name}
                      {self && <span className="person-you"> (you)</span>}
                      {person.owner && <span className="person-tag">Owner</span>}
                    </p>
                    <p className="person-email">{person.email}</p>
                    <p className={`person-status${person.status === "active" ? "" : " warning"}`}>{statusText(person, now)}</p>
                  </div>
                  <div className="person-access">
                    {apps.map((app) => (
                      <AccessPicker
                        key={app.id}
                        app={app}
                        value={person.access[app.id]?.role ?? ""}
                        disabled={locked != null}
                        title={locked ?? undefined}
                        label={`${person.name} in ${app.name}`}
                        onChange={(role) => act(() => updatePerson(person.id, { access: { [app.id]: role } }))}
                      />
                    ))}
                  </div>
                  <Menu
                    label={`More for ${person.name}`}
                    icon={<More />}
                    items={[
                      {
                        label: person.status === "active" ? "New password link" : "New sign-in link",
                        icon: <LinkIcon />,
                        onSelect: () => act(async () => setLink(await newInvite(person.id))),
                      },
                      !self && !person.owner && { label: "Delete account…", icon: <Trash />, danger: true, onSelect: () => setRemoving(person) },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {thisApp && (
          <dl className="role-help">
            {thisApp.roles.map((role) => (
              <div key={role} className="role-help-row">
                <dt>{roleLabel(APP_ID, role)}</dt>
                <dd>{ROLE_HELP[role]}.</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="form-note">
          Sign-in links work once and last {INVITE_DAYS} days. A new password link doesn’t change anything until it’s used.
        </p>
      </main>

      <AddPersonDialog
        open={adding}
        apps={apps}
        onClose={() => setAdding(false)}
        onAdded={(result) => {
          setAdding(false);
          setLink(result);
          void reload();
        }}
      />
      <LinkDialog result={link} apps={apps} onClose={() => setLink(null)} />
      <ConfirmDialog
        open={removing != null}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name}’s account?`}
        description="They’re signed out right away and can’t sign in anywhere. Votes they made stay, and admins can still open them. To take away just this site, set it to “No access” instead."
        confirmLabel="Delete account"
        onConfirm={() => removing && act(() => deletePerson(removing.id))}
      />
    </div>
  );
}

export default PeoplePage;
