import { CAUCUSES, PARTIES, STATE_NAMES } from "../constants";
import { effectiveVote, stateOf } from "./voteTypes";

// Facets combine the way most filter UIs do: any-of within a facet, all-of across
// facets. "CPC" + "CBC" + "New York" means (CPC or CBC) and from New York.
export const FACETS = ["position", "party", "caucus", "state"];

export const EMPTY_FILTERS = { query: "", position: [], party: [], caucus: [], state: [] };

export function hasActiveFilters(filters) {
  return filters.query.trim() !== "" || FACETS.some((facet) => filters[facet].length > 0);
}

/** The value(s) a member has for a facet. */
function facetValues(member, facet, ctx) {
  switch (facet) {
    case "position":
      return [effectiveVote(ctx.votes[member.id], ctx.type) ?? "undecided"];
    case "party":
      return [member.party];
    case "caucus":
      return member.groups;
    case "state":
      return [stateOf(member)];
    default:
      return [];
  }
}

function matchesQuery(member, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const state = stateOf(member);
  return [member.name, member.district, state, STATE_NAMES[state] ?? ""].some((text) =>
    text.toLowerCase().includes(needle),
  );
}

export function filterMembers(members, filters, ctx, exceptFacet = null) {
  return members.filter((member) => {
    if (!matchesQuery(member, filters.query)) return false;
    return FACETS.every((facet) => {
      if (facet === exceptFacet || filters[facet].length === 0) return true;
      const values = facetValues(member, facet, ctx);
      return filters[facet].some((value) => values.includes(value));
    });
  });
}

/**
 * Options for one facet, with how many members each would show given every
 * *other* active filter. Options already selected are always listed.
 */
export function facetOptions(members, filters, ctx, facet, countCtx = ctx) {
  const pool = filterMembers(members, filters, ctx, facet);
  const counts = new Map();
  for (const member of pool) {
    for (const value of facetValues(member, facet, countCtx)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  let universe;
  if (facet === "position") {
    universe = ["yes", "no", "other", "present", "undecided"].filter((value) => {
      if (value === "other") return Boolean(ctx.type.candidates);
      if (value === "present") return ctx.type.allowsPresent !== false;
      return true;
    });
  } else {
    const all = new Set(members.flatMap((member) => facetValues(member, facet, ctx)));
    universe = Array.from(all);
    if (facet === "party") universe.sort((a, b) => Object.keys(PARTIES).indexOf(a) - Object.keys(PARTIES).indexOf(b));
    else if (facet === "caucus") universe.sort((a, b) => (CAUCUSES[a]?.name ?? a).localeCompare(CAUCUSES[b]?.name ?? b));
    else universe.sort((a, b) => (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[b] ?? b));
  }

  return universe.map((value) => ({ value, count: counts.get(value) ?? 0 }));
}

export function toggleFilterValue(filters, facet, value) {
  const current = filters[facet];
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  return { ...filters, [facet]: next };
}
