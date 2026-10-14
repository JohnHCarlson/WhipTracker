import { Reset } from "./components/Icons";
import { useAuth, useUpdateReady } from "./lib/api";
import { usePath } from "./lib/router";
import { useTheme } from "./lib/storage";
import { InvitePage, LoginPage, UnreachablePage } from "./pages/AuthPages";
import PeoplePage from "./pages/PeoplePage";
import VoteListPage from "./pages/VoteListPage";
import VotePage from "./pages/VotePage";

/** After a deploy, pages that were already open offer to load the new version. */
function UpdateBanner() {
  const ready = useUpdateReady();
  if (!ready) return null;
  return (
    <div className="update-banner" role="status">
      <Reset width={16} height={16} />
      <p>A new version of the site is ready.</p>
      <button type="button" className="link-button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}

/*
 * Addresses: / is the list of votes, /v/<id> one vote, /people the People page (admins),
 * and /invite/<token> where a sign-in link lands. Everything but the last needs a sign-in.
 */
function App() {
  const auth = useAuth();
  const path = usePath();
  const [theme, toggleTheme] = useTheme();
  const themed = { theme, onToggleTheme: toggleTheme };

  const invite = /^\/invite\/([\w-]+)$/.exec(path);
  if (invite) return <InvitePage token={invite[1]} />;
  if (auth.status === "loading") return null;
  if (auth.status === "unreachable") return <UnreachablePage />;
  if (auth.status === "signed-out") return <LoginPage />;

  const vote = /^\/v\/([\w-]+)$/.exec(path);
  const page = vote ? (
    <VotePage id={vote[1]} {...themed} />
  ) : path === "/people" && (auth.user.role === "admin" || auth.user.owner) ? (
    <PeoplePage {...themed} />
  ) : (
    <VoteListPage {...themed} />
  );

  return (
    <>
      <UpdateBanner />
      {page}
    </>
  );
}

export default App;
