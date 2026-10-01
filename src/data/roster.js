import caucuses from "./caucuses.json";
import roster from "./members.json";

// members.json is generated from the Clerk (npm run roster); caucuses.json is kept by
// hand. Joining them here means caucus edits never need the script.
const groupsById = {};
for (const [caucus, ids] of Object.entries(caucuses)) {
  for (const id of Object.keys(ids)) (groupsById[id] ??= []).push(caucus);
}

export const members = roster.map((member) => ({ ...member, groups: groupsById[member.id] ?? [] }));
export const memberIds = new Set(members.map((member) => member.id));
