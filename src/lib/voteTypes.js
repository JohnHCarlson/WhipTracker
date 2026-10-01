// Vote rules for the House floor.
//
// A member's position is "yes" | "no" | "other" | "present" | null (undecided).
// "other" only exists in candidate elections (a protest vote or a third candidate);
// everywhere else it counts as "no".
// "Votes needed" always assumes the worst case: every undecided member shows up
// and votes. Present votes and absences can only lower the bar.

import { STATES } from "../constants";

/** Seats in the House. Fixed-majority thresholds (218) never drop for vacancies. */
export const HOUSE_SEATS = 435;

export const VOTE_TYPE_GROUPS = [
  { id: "majority", label: "Majority" },
  { id: "two-thirds", label: "Two-thirds" },
  { id: "special", label: "Special thresholds" },
];

const DEFAULT_LABELS = { yes: "Yes", no: "No", present: "Present", undecided: "Undecided" };

export const VOTE_TYPES = [
  {
    id: "passage",
    group: "majority",
    name: "Passage",
    summary: "Bills, resolutions, amendments, rules and most motions",
    rule: "majority",
    labels: DEFAULT_LABELS,
    about: "Majority of those voting. Yeas have to beat nays; a tie fails. Present counts toward a quorum and nothing else.",
  },
  {
    id: "committee-of-the-whole",
    group: "majority",
    name: "Committee of the Whole",
    summary: "Amendments during debate on a bill",
    rule: "majority",
    labels: DEFAULT_LABELS,
    allowsDelegateOption: true,
    about:
      "Majority of those voting, with a quorum of 100 and 25 to get a recorded vote. Delegates vote only when the rules package allows it. If their votes decide it, the Committee rises and the House votes again without them.",
  },
  {
    id: "speaker",
    group: "majority",
    name: "Election of Speaker",
    summary: "Roll call by surname",
    rule: "majority",
    candidates: {
      defaults: ["Cand. A", "Cand. B", "Other"],
      placeholders: ["Candidate A", "Candidate B", "Other votes"],
    },
    defeatedLabel: "can't win",
    about:
      "Majority of votes cast for a person by name. Every vote for someone else counts against you, including protest votes, and a plurality doesn't win. Present lowers the number needed.",
  },
  {
    id: "suspension",
    group: "two-thirds",
    name: "Suspension of the rules",
    summary: "40 minutes, no amendments",
    rule: "two-thirds",
    labels: DEFAULT_LABELS,
    about: "Two-thirds of those voting. Present doesn't count.",
  },
  {
    id: "veto-override",
    group: "two-thirds",
    name: "Veto override",
    summary: "Passing a bill over the President's objections",
    rule: "two-thirds",
    labels: DEFAULT_LABELS,
    about: "Two-thirds of those voting, a quorum being present. Present doesn't count.",
  },
  {
    id: "constitutional-amendment",
    group: "two-thirds",
    name: "Constitutional amendment",
    summary: "Joint resolution proposing an amendment",
    rule: "two-thirds",
    labels: DEFAULT_LABELS,
    about: "Two-thirds of those voting, then three-fourths of the states. Present doesn't count.",
  },
  {
    id: "discharge-petition",
    group: "special",
    name: "Discharge petition",
    summary: "Signatures to pull a bill out of committee",
    rule: "full-membership",
    labels: { yes: "Signed", no: "Won't sign", present: null, undecided: "Undecided" },
    allowsPresent: false,
    neededLabel: "Signatures needed",
    defeatedLabel: "can't get there",
    about: "218 signatures, a majority of the full House. Vacancies don't lower it and there's no present.",
  },
  {
    id: "contingent-election",
    group: "special",
    name: "Contingent presidential election",
    summary: "12th Amendment: no one reached 270",
    rule: "state-delegations",
    unit: "states",
    candidates: {
      defaults: ["Cand. A", "Cand. B", "Cand. C"],
      placeholders: ["Candidate A", "Candidate B", "Candidate C"],
    },
    neededLabel: "States needed",
    totalLabel: "State delegations",
    defeatedLabel: "can't win",
    about:
      "One vote per state and 26 to win, from the top three electoral vote-getters. A delegation votes for whoever has a majority of its votes; otherwise it's divided, which counts against everyone. DC and the territories don't vote.",
  },
];

export const DEFAULT_VOTE_TYPE_ID = "passage";

export function getVoteType(id) {
  return VOTE_TYPES.find((type) => type.id === id) ?? VOTE_TYPES[0];
}

/**
 * Labels for each position. Candidate elections use the names typed in, falling back
 * to "Cand. A" etc. Pass `forCounts` for the tally, where state-level buckets differ.
 */
export function resolveLabels(type, names = [], { forCounts = false } = {}) {
  let labels = type.labels;
  if (type.candidates) {
    const [yes, no, other] = type.candidates.defaults.map((fallback, i) => names[i]?.trim() || fallback);
    labels = { yes, no, other, present: "Present", undecided: "Undecided" };
  }
  if (forCounts && type.unit === "states") return { ...labels, present: "Divided", undecided: "In play" };
  return labels;
}

/** Short label for the threshold line, e.g. "16 to pass". */
export function neededPhrase(type, needed) {
  if (type.unit === "states") return `${needed} ${needed === 1 ? "state" : "states"}`;
  if (type.rule === "full-membership") return `${needed} signatures`;
  if (type.candidates) return `${needed} to win`;
  return `${needed} to pass`;
}

export function stateOf(member) {
  return member.district.split("-")[0];
}

/** Whether a member casts a vote under this vote type. */
export function isEligible(member, type, { delegatesVote = false } = {}) {
  if (!member.delegate) return true;
  return Boolean(type.allowsDelegateOption && delegatesVote);
}

/** A member's position as it counts for this vote type (e.g. no "present" on a petition). */
export function effectiveVote(vote, type) {
  if (vote === "present" && type.allowsPresent === false) return null;
  if (vote === "other" && !type.candidates) return "no";
  return vote ?? null;
}

function countVotes(members, votes, type) {
  const counts = { yes: 0, no: 0, other: 0, present: 0, undecided: 0 };
  for (const member of members) {
    const vote = effectiveVote(votes[member.id], type);
    counts[vote ?? "undecided"] += 1;
  }
  return counts;
}

function neededFor(rule, total, present) {
  const voting = total - present;
  if (rule === "majority") return Math.floor(voting / 2) + 1;
  if (rule === "two-thirds") return Math.max(1, Math.ceil((2 * voting) / 3));
  // full-membership: a majority of all 435 seats, however many are filled or show up.
  return Math.floor(HOUSE_SEATS / 2) + 1;
}

// `reachable` is the most yes could still get: yes plus everything not yet locked.
function statusFor(yes, reachable, needed) {
  if (yes >= needed) return { status: "secured", margin: yes - needed };
  if (reachable < needed) return { status: "defeated", margin: needed - yes };
  return { status: "open", margin: needed - yes };
}

function memberTally(members, votes, type, options) {
  const counts = countVotes(members, votes, type);
  const total = members.length;
  const needed = neededFor(type.rule, total, counts.present);
  const baseline = neededFor(type.rule, total, 0);
  const notes = [];

  if (type.rule !== "full-membership" && counts.present > 0 && needed < baseline) {
    notes.push({
      tone: "info",
      text: `${counts.present} present ${counts.present === 1 ? "vote lowers" : "votes lower"} the bar from ${baseline} to ${needed}.`,
    });
  }

  if (type.allowsDelegateOption && options.delegatesVote) {
    const delegateCounts = countVotes(
      members.filter((member) => member.delegate),
      votes,
      type,
    );
    const passesWith = counts.yes > counts.no;
    const passesWithout = counts.yes - delegateCounts.yes > counts.no - delegateCounts.no;
    if (counts.yes + counts.no > 0 && passesWith !== passesWithout) {
      notes.push({
        tone: "warning",
        text: "Delegates are decisive at this count. The Committee would rise and the House would vote again without them.",
      });
    }
  }

  return {
    unit: "members",
    total,
    counts,
    needed,
    ...statusFor(counts.yes, counts.yes + counts.undecided, needed),
    notes,
  };
}

/**
 * Resolve one state delegation: "yes" / "no" / "other" once a candidate has a locked
 * majority of votes cast, "divided" once everyone is counted and no one does, else "open".
 */
export function delegationResult({ yes, no, other = 0, undecided }) {
  const cast = yes + no + other + undecided;
  if (yes * 2 > cast) return "yes";
  if (no * 2 > cast) return "no";
  if (other * 2 > cast) return "other";
  if (undecided === 0) return "divided";
  return "open";
}

/** Whether candidate A can still carry the delegation if every undecided member breaks their way. */
function yesCanCarry({ yes, no, other, undecided }) {
  return yes + undecided > no + other;
}

function stateTally(members, votes, type) {
  // Every state gets a vote, even one whose whole delegation is vacant.
  const byState = new Map(STATES.map((state) => [state, []]));
  for (const member of members) {
    const state = stateOf(member);
    if (!byState.has(state)) byState.set(state, []);
    byState.get(state).push(member);
  }

  const delegations = Array.from(byState, ([state, stateMembers]) => {
    const counts = countVotes(stateMembers, votes, type);
    return { state, counts, result: stateMembers.length === 0 ? "vacant" : delegationResult(counts) };
  });

  const counts = { yes: 0, no: 0, other: 0, present: 0, undecided: 0 };
  const bucket = { yes: "yes", no: "no", other: "other", divided: "present", vacant: "present", open: "undecided" };
  let stillPossible = 0;
  for (const delegation of delegations) {
    counts[bucket[delegation.result]] += 1;
    if (delegation.result === "open" && yesCanCarry(delegation.counts)) stillPossible += 1;
  }

  const total = delegations.length;
  const needed = Math.floor(total / 2) + 1;
  const notes = [];
  if (counts.present > 0) {
    notes.push({
      tone: "info",
      text: `${counts.present} divided or vacant ${counts.present === 1 ? "delegation counts" : "delegations count"} against everyone. The bar stays at ${needed}.`,
    });
  }

  return {
    unit: "states",
    total,
    counts,
    needed,
    ...statusFor(counts.yes, counts.yes + stillPossible, needed),
    notes,
    delegations,
  };
}

/**
 * Tally a vote.
 * @param members eligible members only (see isEligible)
 * @param votes   map of member id -> position
 */
export function computeTally(members, votes, type, options = {}) {
  if (type.rule === "state-delegations") return stateTally(members, votes, type);
  return memberTally(members, votes, type, options);
}
