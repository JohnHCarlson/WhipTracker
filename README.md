# Whip Tracker

Track where every Member of the House stands on a floor vote.

```bash
npm install
npm run dev      # local dev server
npm test         # vote-rule math tests
npm run deploy   # build and publish to GitHub Pages
```

## Using it

- **Vote type** (top left of the tally) sets the rules. "How it's counted" gives a one-line
  refresher. Speaker and contingent elections take candidate names.
- **Filters** combine: any-of within a group, all-of across groups. Picking a filter
  selects everyone it shows, so CPC → New York → Yes is three clicks. Search doesn't select.
- **Selection** can be tuned by clicking cards (Shift-click for a range). Setting a
  position clears the filters and selection; the toast's Undo brings all of it back.

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ A` | Select everyone shown |
| `Y` `N` `P` `U` | Set selection to Yes / No / Present / Undecided |
| `1` `2` `3` | Candidate A / B / C (Speaker and contingent elections) |
| `Esc` | Deselect |
| `Ctrl/⌘ Z`, `Shift+Ctrl/⌘ Z` | Undo / redo |
| `/` | Search |

## Data

- **Roster** (`src/data/members.json`) comes from the House Clerk's member list and
  official photos. Refresh it after special elections or resignations:

  ```bash
  npm run roster
  ```

  It rewrites the roster, downloads photos for new members into `public/members/`, and
  removes photos of members who left. Nicknames come from the congress-legislators
  project; anything still too formal goes in `NAME_OVERRIDES` in
  `scripts/build-roster.mjs`.
- **Caucuses** (`src/data/caucuses.json`) are kept by hand: Bioguide ID → name. Add or
  remove a line to change membership; `npm test` flags anyone who's no longer on the
  roster. Taken from each caucus's site (CAPAC: full members only, not associates).
- Members are keyed by Bioguide ID. Positions are saved in the browser separately, so
  roster updates never lose them. Delegates only vote in the Committee of the Whole when
  "Delegates vote" is on.
