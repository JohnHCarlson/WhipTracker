import { voteOrder } from "../constants";

export function loadMembers(initialMembers) {
  try {
    const saved = window.localStorage.getItem("whip-tracker-members");
    if (!saved) return initialMembers;

    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.members)) return parsed.members;
  } catch {
    // Ignore invalid storage data and fall back to the starter roster.
  }

  return initialMembers;
}

export function getStateOptions(members) {
  const states = new Set(members.map((member) => member.district.split("-")[0]));
  return Array.from(states).sort();
}

export function filterMembers(members, partyFilter, groupFilters, stateFilters) {
  return members.filter((member) => {
    const partyMatch = partyFilter === "all" || member.party === partyFilter;
    const stateMatch = stateFilters.length === 0 || stateFilters.some((state) => member.district.startsWith(`${state}-`));
    const groupMatch = groupFilters.length === 0 || groupFilters.some((group) => member.groups.includes(group));
    return partyMatch && stateMatch && groupMatch;
  });
}

export function buildSummary(members, voteType) {
  const totals = voteOrder.reduce((acc, vote) => {
    acc[vote] = members.filter((member) => member.vote === vote).length;
    return acc;
  }, {});

  const totalMembers = members.length;
  const votingMembers = totals.yes + totals.no;
  const effectiveMembers = totalMembers - totals.present;
  const effectiveCount = Math.max(1, effectiveMembers);
  const yesShare = totalMembers ? totals.yes / totalMembers : 0;
  const noShare = totalMembers ? totals.no / totalMembers : 0;
  const presentShare = totalMembers ? totals.present / totalMembers : 0;

  let passed = false;
  let thresholdLabel = "";
  let yesNeeded = 0;

  if (voteType === "simple-majority") {
    const needed = Math.floor(effectiveCount / 2) + 1;
    passed = totals.yes >= needed;
    thresholdLabel = `Yes ≥ ${needed} of ${effectiveCount}`;
    yesNeeded = needed;
  } else if (voteType === "absolute-majority") {
    const needed = Math.floor(totalMembers / 2) + 1;
    passed = totals.yes >= needed;
    thresholdLabel = `Yes ≥ ${needed} of ${totalMembers}`;
    yesNeeded = needed;
  } else if (voteType === "simple-supermajority") {
    const needed = Math.floor(effectiveCount * (2 / 3)) + 1;
    passed = totals.yes >= needed;
    thresholdLabel = `Yes ≥ ${needed} of ${effectiveCount}`;
    yesNeeded = needed;
  } else if (voteType === "absolute-supermajority") {
    const needed = Math.floor(totalMembers * (2 / 3)) + 1;
    passed = totals.yes >= needed;
    thresholdLabel = `Yes ≥ ${needed} of ${totalMembers}`;
    yesNeeded = needed;
  }

  return {
    total: totalMembers,
    yes: totals.yes,
    no: totals.no,
    present: totals.present,
    presentOrVoting: totals.yes + totals.no + totals.present,
    yesShare,
    noShare,
    presentShare,
    votingMembers,
    passed,
    thresholdLabel,
    yesNeeded,
  };
}
