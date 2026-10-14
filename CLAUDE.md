# Whip Tracker: notes for Claude

Counts where every House member stands on a floor vote, as saved votes that
people share. Live at https://votes.jcvc.io on John's DigitalOcean droplet
(`deploy/README.md`). See README.md for commands.

The pages are React 18 in plain JavaScript with hand-written CSS (tokens in
`src/index.css`), no UI library. The server (`server/`) is TypeScript: Hono
and Node's built-in SQLite, bundled into one file by esbuild, the same as
Election Night (`D:\Dev\Election Night Dashboard`).

## Working rules

- Accounts live in the accounts service (`D:\Dev\Accounts`), shared with
  John's other apps. This app keeps only its sessions and a cache of what the
  service said (`server/auth.ts`); it never stores passwords. All calls to the
  service go through `server/accounts.ts`.
- What someone can do with a vote is decided in `server/votes.ts`, and the
  pages use the same rules from `src/lib/access.js`. The pages only hide what
  someone can't use.
- The open vote's syncing is all in `src/lib/voteStore.js`: optimistic
  changes, sent in order, versioned, with a live connection per vote. Pages
  don't call the votes API for positions or settings directly.
- Positions are saved as changes to a few members, never the whole vote, so
  people working at the same time don't overwrite each other. Undo is per
  person (`src/lib/useVoteHistory.js`).
- On the droplet, show John every command and get his OK before running it,
  read-only ones included. `npm run deploy` counts. Don't touch anything of
  Election Night's there (its site, service, folders, env file or
  `/etc/sudoers.d/john-app`).
- The repo is public. No secrets in it: keys and test passwords live in
  `.env` and `data/`, both ignored.
- Check changes at phone width (390px) too.
- This folder is in OneDrive: `tsx watch` hangs here, so `dev:api` uses
  Node's own `--watch`.
- Commit only when asked.
