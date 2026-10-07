import { describe, expect, it } from "vitest";
import { ASSOCIATIONS, CAUCUSES } from "../constants";
import associations from "./associations.json";
import caucuses from "./caucuses.json";
import roster from "./members.json";

const ids = new Set(roster.map((member) => member.id));

describe("roster data", () => {
  it("has unique Bioguide IDs and at most 435 voting members", () => {
    expect(ids.size).toBe(roster.length);
    expect(roster.filter((member) => !member.delegate).length).toBeLessThanOrEqual(435);
    expect(roster.filter((member) => member.delegate)).toHaveLength(6);
  });

  it("only lists caucus members who are on the roster", () => {
    for (const [caucus, members] of Object.entries(caucuses)) {
      expect(CAUCUSES[caucus], `${caucus} needs a name in constants.js`).toBeDefined();
      const strays = Object.entries(members).filter(([id]) => !ids.has(id));
      expect(strays, `${caucus} lists people not on the roster`).toEqual([]);
    }
  });

  it("only lists association members who are on the roster", () => {
    expect(Object.keys(associations).sort()).toEqual(Object.keys(ASSOCIATIONS).sort());
    for (const [association, members] of Object.entries(associations)) {
      const strays = Object.entries(members).filter(([id]) => !ids.has(id));
      expect(strays, `${association} lists people not on the roster`).toEqual([]);
    }
  });
});
