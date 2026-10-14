// Who can do what. The server enforces it (server/votes.ts, server/auth.ts); the pages use
// the same rules to hide what someone can't use.

/** @type {readonly ["member", "admin"]} */
export const ROLES = ["member", "admin"];

export const ROLE_LABEL = { member: "Member", admin: "Admin" };
export const ROLE_HELP = {
  member: "Makes votes and sees the ones shared with them",
  admin: "Also sees and edits every vote, and manages people",
};

/**
 * Someone's access to one vote: "owner" made it; "admin" is an admin who didn't; "edit" and
 * "view" come from sharing.
 * @typedef {"owner" | "admin" | "edit" | "view"} Access
 */

export const PERMISSION_LABEL = { edit: "Can edit", view: "Can view" };

/** @param {Access | null | undefined} access */
export const canEdit = (access) => access === "owner" || access === "admin" || access === "edit";
/** Sharing, renaming and deleting. @param {Access | null | undefined} access */
export const canManage = (access) => access === "owner" || access === "admin";

export const isAdmin = (user) => user?.role === "admin";

export const MIN_PASSWORD = 10;
export const INVITE_DAYS = 7;
export const TITLE_MAX = 120;
