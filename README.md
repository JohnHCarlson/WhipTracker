# Whip Tracker

Track where every Member of the House stands on a floor vote. Each count is a
saved vote you can come back to and share. It lives at **https://votes.jcvc.io**,
behind a sign-in.

## Using it

- **Votes** (`/`): your votes, the ones shared with you, and (for admins)
  everyone else's. **New vote** makes one; give it a name like "H.R. 1" or
  "Election of Speaker 2027". **Duplicate** copies a vote's positions into a
  new one.
- **A vote** (`/v/<id>`): the tracker. Changes save as you make them, and
  everyone with the vote open sees them within a second or two. Click the name
  to rename it.
- **Share** (on the vote, or a card's ⋯ menu): add people who use the Whip
  Tracker, as **Can edit** or **Can view**. Only the person who made a vote,
  or an admin, can share or delete it. People can take a vote shared with them
  off their list.
- **People** (`/people`, admins, from the account menu): who can sign in and
  what they can use. See [Accounts](#accounts).

The tracker itself:

- **Vote type** (top left of the tally) sets the rules. "How it's counted" gives a one-line
  refresher. Speaker and contingent elections take candidate names.
- **Filters** combine: any-of within a group, all-of across groups. Picking a filter
  selects everyone it shows, so CPC → New York → Yes is three clicks. Search doesn't select.
- **Selection** can be tuned by clicking cards (Shift-click for a range). Setting a
  position clears the filters and selection; the toast's Undo brings all of it back.
- **Undo** only undoes your own changes, never someone else's.

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ A` | Select everyone shown |
| `Y` `N` `P` `U` | Set selection to Yes / No / Present / Undecided |
| `1` `2` `3` | Candidate A / B / C (Speaker and contingent elections) |
| `Esc` | Deselect |
| `Ctrl/⌘ Z`, `Shift+Ctrl/⌘ Z` | Undo / redo |
| `/` | Search |

Anyone who used the old version (before sign-in) in the same browser is
offered their saved count once, to save as a vote.

## Accounts

Nobody signs up. Accounts are shared with John's other apps through the
accounts service (`D:\Dev\Accounts`): one email and password, and a separate
role in each app. An admin adds a person on the **People** page and gets a
one-time link to send them (nothing is emailed). Someone who already has an
account for another app just gets access here and signs in with the same
password. A forgotten password works the same way: **New password link** in
that person's ⋯ menu.

- **Member:** makes votes and sees the ones shared with them.
- **Admin:** also sees and edits every vote, and manages people.
- **Owner** (John): manages everyone, in every app.

Election Night still has its own accounts until it moves over to the shared
ones.

## Running it

In PowerShell, type `npm.cmd`, not `npm`. This laptop's execution policy
blocks `npm.ps1`. Git Bash can use plain `npm`.

```bash
npm.cmd install
```

```bash
npm.cmd run dev
```

That starts the accounts service (from `D:\Dev\Accounts`, unless it's already
running; set `ACCOUNTS_DIR` if it's elsewhere), the API (port 3102) and the
page server together; open http://localhost:5173. The local database is
`data/votes.db` (not in git). The API needs this app's key for the accounts
service in `.env` (not in git):

```
ACCOUNTS_URL=http://127.0.0.1:3100
ACCOUNTS_KEY=<from `npx.cmd tsx server/index.ts app-key whip-tracker`, run in D:\Dev\Accounts>
```

The local test accounts and their passwords are in `data/dev-login.txt`. To
make another, run this in `D:\Dev\Accounts` and open the link:

```bash
npx.cmd tsx server/index.ts invite you@example.com --app whip-tracker --name "Your Name" --role admin
```

```bash
npm.cmd test
```

```bash
npm.cmd run build
```

## Putting a new version online

```bash
npm.cmd run deploy
```

It runs the tests, builds, uploads to the droplet over SSH (as john, with
`~/.ssh/jcvc`) and restarts the app, which takes a second or two; open pages
reconnect by themselves and offer to reload. How it's set up on the droplet,
how to roll back, and backups: [deploy/README.md](deploy/README.md).

## Data

- **Votes** are saved on the server (`server/`, SQLite): title, vote type,
  candidate names and positions, who made it, and who it's shared with.
  Positions are saved a few at a time as people click, so two people working
  on one vote don't undo each other. Backups every five minutes while anything
  changes, and before a vote is deleted.
- **Roster** (`src/data/members.json`) comes from the House Clerk's member list and
  official photos. Refresh it after special elections or resignations:

  ```bash
  npm.cmd run roster
  ```

  It rewrites the roster, downloads photos for new members into `public/members/`, and
  removes photos of members who left. Nicknames come from the congress-legislators
  project; anything still too formal goes in `NAME_OVERRIDES` in
  `scripts/build-roster.mjs`.
- **Member associations** (`src/data/associations.json`) are the Clerk's
  [Demographics](https://clerk.house.gov/Members#Demographics) lists (freshmen, veterans,
  women, lawyers, ...), refreshed by the same `npm run roster`. "Leaving office" combines
  the Clerk's Retiring, Running for Other Office and Primary Defeats lists. They're
  filters only and don't appear on cards.
- **Caucuses** (`src/data/caucuses.json`) are kept by hand: Bioguide ID → name. Add or
  remove a line to change membership; `npm test` flags anyone who's no longer on the
  roster. Taken from each caucus's site (CAPAC: full members only, not associates).
  DSA covers members who are DSA members or endorsees, plus former members DSA backed
  (Summer Lee, Greg Casar).
- Members are keyed by Bioguide ID, so roster updates never lose positions; positions
  for members who've left are ignored. Delegates only vote in the Committee of the Whole
  when "Delegates vote" is on.
- **Light or dark** is remembered per browser.
