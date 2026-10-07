import associations from "./associations.json";
import caucuses from "./caucuses.json";
import roster from "./members.json";

// members.json and associations.json are generated from the Clerk (npm run roster);
// caucuses.json is kept by hand. Joining them here means caucus edits never need the script.
function byMember(lists) {
  const result = {};
  for (const [list, ids] of Object.entries(lists)) {
    for (const id of Object.keys(ids)) (result[id] ??= []).push(list);
  }
  return result;
}

const groupsById = byMember(caucuses);
const associationsById = byMember(associations);

export const members = roster.map((member) => ({
  ...member,
  groups: groupsById[member.id] ?? [],
  associations: associationsById[member.id] ?? [],
}));
export const memberIds = new Set(members.map((member) => member.id));
