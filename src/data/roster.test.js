import { describe, expect, it } from "vitest";
import { CAUCUSES } from "../constants";
import caucuses from "./caucuses.json";
import roster from "./members.json";

describe("roster data", () => {
  it("has unique Bioguide IDs and at most 435 voting members", () => {
    const ids = roster.map((member) => member.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(roster.filter((member) => !member.delegate).length).toBeLessThanOrEqual(435);
    expect(roster.filter((member) => member.delegate)).toHaveLength(6);
  });

  it("only lists caucus members who are on the roster", () => {
    const ids = new Set(roster.map((member) => member.id));
    for (const [caucus, members] of Object.entries(caucuses)) {
      expect(CAUCUSES[caucus], `${caucus} needs a name in constants.js`).toBeDefined();
      const strays = Object.entries(members).filter(([id]) => !ids.has(id));
      expect(strays, `${caucus} lists people not on the roster`).toEqual([]);
    }
  });
});
