import { useEffect, useState } from "react";
import Logo from "../components/Logo";
import { MIN_PASSWORD } from "../lib/access";
import { acceptInvite, checkSession, errorMessage, getInvite, signIn } from "../lib/api";
import { Link, navigate } from "../lib/router";
import "./AuthPages.css";

function AuthCard({ title, description, children }) {
  return (
    <main className="auth">
      <div className="auth-card card">
        <div className="auth-brand">
          <Logo size={36} />
          <span className="brand-name">Whip Tracker</span>
        </div>
        <div className="auth-heading">
          <h1 className="auth-title">{title}</h1>
          {description && <p className="auth-description">{description}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}

/** Shown at any address until someone signs in; afterwards they land on the page they asked for. */
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Sign in" description="Your saved votes, and the ones shared with you.">
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button primary auth-submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="form-note">No account yet, or forgot your password? Ask an admin to send you a link.</p>
    </AuthCard>
  );
}

/** Where an invite link lands: set a password, and you're signed in. */
export function InvitePage({ token }) {
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getInvite(token).then(setInvite, (e) => setLoadError(errorMessage(e)));
  }, [token]);

  if (loadError)
    return (
      <AuthCard title="This link doesn’t work" description={loadError}>
        <Link to="/" className="button auth-submit" onClick={() => void checkSession()}>
          Go to sign in
        </Link>
      </AuthCard>
    );
  if (!invite) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The two passwords don’t match.");
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(token, password);
      navigate("/", { replace: true });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title={invite.hasPassword ? "Set a new password" : `Welcome, ${invite.name.split(" ")[0]}`}
      description={
        <>
          {invite.hasPassword ? "For" : "Choose a password for"} <strong>{invite.email}</strong>. You’ll use it with that email to sign in
          {invite.hasPassword ? ", here and on any other site you use with this account." : "."}
        </>
      }
    >
      <form className="form" onSubmit={submit}>
        {/* Lets password managers save the new password under the right email. */}
        <input type="email" autoComplete="username" value={invite.email} readOnly hidden />
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="field-hint">At least {MIN_PASSWORD} characters.</span>
        </label>
        <label className="field">
          <span className="field-label">Type it again</span>
          <input className="input" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button primary auth-submit" disabled={busy}>
          {busy ? "Saving…" : "Save and sign in"}
        </button>
      </form>
    </AuthCard>
  );
}

export function UnreachablePage() {
  return (
    <AuthCard title="Can’t reach the server" description="Check your connection. The site may also be restarting for an update.">
      <button type="button" className="button primary auth-submit" onClick={() => window.location.reload()}>
        Try again
      </button>
    </AuthCard>
  );
}
