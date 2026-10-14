import { signOut, useUser } from "../lib/api";
import { Link, navigate } from "../lib/router";
import Logo from "./Logo";
import Menu from "./Menu";
import ProgressBar from "./ProgressBar";
import { StatusPill } from "./TallyPanel";
import { Moon, People, SignOut, Sun } from "./Icons";
import "./AppHeader.css";

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function AccountMenu({ user }) {
  const managesPeople = user.role === "admin" || user.owner;
  return (
    <Menu
      label={`Account: ${user.name}`}
      className="account-button"
      header={
        <div className="account-summary">
          <span className="account-name">{user.name}</span>
          <span className="account-email">{user.email}</span>
        </div>
      }
      items={[
        managesPeople && { label: "People", icon: <People />, onSelect: () => navigate("/people") },
        { label: "Sign out", icon: <SignOut />, onSelect: () => void signOut().then(() => navigate("/", { replace: true })) },
      ]}
    >
      <span aria-hidden="true">{initials(user.name)}</span>
    </Menu>
  );
}

/** The bar across the top of every page. Pages can put something in the middle and extra buttons on the right. */
function AppHeader({ theme, onToggleTheme, center, actions }) {
  const user = useUser();
  return (
    <header className="app-header glass">
      <div className="app-header-inner">
        <Link to="/" className="brand" aria-label="Whip Tracker: all votes">
          <Logo />
          <span className="brand-name">Whip Tracker</span>
        </Link>

        <div className="header-center">{center}</div>

        <div className="header-actions">
          {actions}
          {actions && <span className="header-divider" aria-hidden="true" />}
          <button
            type="button"
            className="icon-button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
          {user && <AccountMenu user={user} />}
        </div>
      </div>
    </header>
  );
}

/** The vote's tally, squeezed into the header once the full one scrolls away. */
export function MiniTally({ tally, type, labels, shown }) {
  return (
    <div className={`mini-tally${shown ? " shown" : ""}`} aria-hidden={!shown}>
      <span className="mini-tally-type">{type.name}</span>
      <ProgressBar tally={tally} type={type} labels={labels} compact />
      <span className="mini-tally-score">
        {tally.counts.yes}
        <span className="mini-tally-of">/{tally.needed}</span>
      </span>
      <StatusPill tally={tally} type={type} labels={labels} compact />
    </div>
  );
}

export default AppHeader;
