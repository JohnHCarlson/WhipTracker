import { describe, expect, it } from "vitest";
import { computeTally, delegationResult, effectiveVote, getVoteType, isEligible, resolveLabels } from "./voteTypes";

// Build a roster of `n` members in one state, plus a votes map from a spec like
// { yes: 3, no: 2, present: 1 } (the rest are undecided).
function roster(n, spec = {}, { state = "NY", idStart = 1, delegate = false } = {}) {
  const members = Array.from({ length: n }, (_, i) => ({
    id: idStart + i,
    district: `${state}-${String(i + 1).padStart(2, "0")}`,
    ...(delegate ? { delegate: true } : {}),
  }));
  const votes = {};
  let i = 0;
  for (const [vote, count] of Object.entries(spec)) {
    for (let k = 0; k < count; k += 1) votes[members[i++].id] = vote;
  }
  return { members, votes };
}

const tally = (typeId, n, spec, options) => {
  const { members, votes } = roster(n, spec);
  return computeTally(members, votes, getVoteType(typeId), options);
};

describe("majority of those voting (passage)", () => {
  it("needs 218 of a full House", () => {
    expect(tally("passage", 435, {}).needed).toBe(218);
  });

  it("present votes lower the bar", () => {
    const result = tally("passage", 435, { present: 6 });
    expect(result.needed).toBe(215); // 429 voting
    expect(result.notes[0].text).toMatch(/lower the bar from 218 to 215/);
  });

  it("is secured only when yes wins even if every undecided member votes no", () => {
    expect(tally("passage", 10, { yes: 6 }).status).toBe("secured");
    expect(tally("passage", 10, { yes: 5 }).status).toBe("open"); // 5-5 tie fails
  });

  it("is defeated when yes can't win even if every undecided member votes yes", () => {
    expect(tally("passage", 10, { no: 5 }).status).toBe("defeated"); // best case 5-5
    expect(tally("passage", 10, { no: 4 }).status).toBe("open");
  });
});

describe("Speaker election", () => {
  it("matches the January 2023 15th ballot: 216 of 428 named votes", () => {
    // 434 Members, 6 present: McCarthy 216, Jeffries 212.
    const result = tally("speaker", 434, { yes: 216, no: 212, present: 6 });
    expect(result.needed).toBe(215);
    expect(result.status).toBe("secured");
  });
});

describe("candidate elections", () => {
  it("names positions after the candidates, with fallbacks", () => {
    const labels = resolveLabels(getVoteType("speaker"), ["Johnson", " ", ""]);
    expect(labels).toMatchObject({ yes: "Johnson", no: "Cand. B", other: "Other", present: "Present" });
    expect(resolveLabels(getVoteType("passage"), ["ignored"]).yes).toBe("Yes");
  });

  it("counts protest votes against your candidate", () => {
    // 216 for A, 200 for B, 12 for others, 6 present: 428 named votes, 215 needed.
    const result = tally("speaker", 434, { yes: 216, no: 200, other: 12, present: 6 });
    expect(result.needed).toBe(215);
    expect(result.status).toBe("secured");
    expect(tally("speaker", 434, { yes: 214, no: 200, other: 14, present: 6 }).status).toBe("defeated");
  });

  it("treats a third-candidate vote as a no on ordinary questions", () => {
    expect(effectiveVote("other", getVoteType("passage"))).toBe("no");
    expect(effectiveVote("other", getVoteType("speaker"))).toBe("other");
  });
});

describe("two-thirds of those voting", () => {
  it("needs 290 of a full House", () => {
    expect(tally("suspension", 435, {}).needed).toBe(290);
  });

  it("passes at exactly two-thirds", () => {
    expect(tally("veto-override", 9, { yes: 6, no: 3 }).status).toBe("secured");
    expect(tally("veto-override", 9, { yes: 4, no: 2, present: 3 }).status).toBe("secured"); // 4 of 6 voting
    expect(tally("veto-override", 9, { yes: 5, no: 3, present: 1 }).status).toBe("defeated"); // 62.5%
  });
});

describe("discharge petition", () => {
  it("needs a majority of the full membership regardless of present or absence", () => {
    const result = tally("discharge-petition", 435, { yes: 217, present: 20 });
    expect(result.needed).toBe(218);
    expect(result.status).toBe("open");
    expect(result.counts.present).toBe(0); // no present option on a petition
    expect(result.counts.undecided).toBe(218);
  });
});

describe("Committee of the Whole", () => {
  const type = getVoteType("committee-of-the-whole");
  const house = roster(10, { yes: 5, no: 5 });
  const delegates = roster(2, { yes: 2 }, { state: "DC", idStart: 100, delegate: true });
  const everyone = [...house.members, ...delegates.members];
  const votes = { ...house.votes, ...delegates.votes };

  it("only lets delegates vote when the option is on", () => {
    expect(everyone.filter((m) => isEligible(m, type, { delegatesVote: false }))).toHaveLength(10);
    expect(everyone.filter((m) => isEligible(m, type, { delegatesVote: true }))).toHaveLength(12);
    expect(isEligible(delegates.members[0], getVoteType("passage"), { delegatesVote: true })).toBe(false);
  });

  it("warns when delegate votes are decisive", () => {
    const result = computeTally(everyone, votes, type, { delegatesVote: true });
    expect(result.notes.some((note) => note.tone === "warning")).toBe(true);
  });
});

describe("contingent election", () => {
  it("resolves delegations", () => {
    expect(delegationResult({ yes: 3, no: 1, undecided: 1 })).toBe("yes");
    expect(delegationResult({ yes: 2, no: 2, undecided: 0 })).toBe("divided");
    expect(delegationResult({ yes: 0, no: 0, undecided: 0 })).toBe("divided"); // everyone present
    expect(delegationResult({ yes: 1, no: 3, undecided: 1 })).toBe("no");
    expect(delegationResult({ yes: 2, no: 2, undecided: 1 })).toBe("open");
    // Three-way: a plurality doesn't carry the state.
    expect(delegationResult({ yes: 3, no: 2, other: 2, undecided: 0 })).toBe("divided");
    expect(delegationResult({ yes: 1, no: 1, other: 4, undecided: 0 })).toBe("other");
  });

  it("counts states, and divided states count against", () => {
    const ny = roster(5, { yes: 3, no: 2 }, { state: "NY" });
    const ct = roster(4, { yes: 2, no: 2 }, { state: "CT", idStart: 50 });
    const pa = roster(3, { yes: 1 }, { state: "PA", idStart: 80 });
    const result = computeTally(
      [...ny.members, ...ct.members, ...pa.members],
      { ...ny.votes, ...ct.votes, ...pa.votes },
      getVoteType("contingent-election"),
    );
    expect(result.total).toBe(3);
    expect(result.needed).toBe(2);
    expect(result.counts).toEqual({ yes: 1, no: 0, other: 0, present: 1, undecided: 1 });
    expect(result.status).toBe("open");
  });
});
