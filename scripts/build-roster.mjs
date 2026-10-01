// Rebuilds src/data/members.json from the House Clerk's member list and downloads
// official photos into public/members/. Caucus membership is hand-kept in
// src/data/caucuses.json and isn't touched here.
//
//   npm run roster            refresh the roster, fetch photos that are missing
//   npm run roster -- --photos-only / --force-photos

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEMBERS_JSON = join(ROOT, "src/data/members.json");
const PHOTO_DIR = join(ROOT, "public/members");
const CLERK_XML = "https://clerk.house.gov/xml/lists/MemberData.xml";
const LEGISLATORS = "https://unitedstates.github.io/congress-legislators/legislators-current.json";
const PHOTO_URL = (id) => `https://clerk.house.gov/images/members/${id}.jpg`;
const PHOTO_SIZE = 144; // shown at 48px, so 3x for sharp screens
const UA = "Mozilla/5.0 (whip-tracker roster script)";

// Official names that nobody uses on the Floor. Keyed by Bioguide ID; add to taste.
const NAME_OVERRIDES = {
  B001292: "Don Beyer",
  B001307: "Jim Baird",
  B001323: "Nick Begich",
  B001327: "Rob Bresnahan",
  C001110: "Lou Correa",
  C001123: "Gil Cisneros",
  C001136: "Herb Conaway",
  D000230: "Don Davis",
  D000530: "Chris Deluzio",
  G000599: "Dan Goldman",
  H001098: "Abe Hamadeh",
  J000295: "Dave Joyce",
  K000375: "Bill Keating",
  K000398: "Tom Kean Jr.",
  K000399: "Jen Kiggans",
  K000402: "Tim Kennedy",
  L000566: "Bob Latta",
  L000599: "Mike Lawler",
  L000600: "Nick Langworthy",
  M001204: "Dan Meuser",
  M001206: "Joe Morelle",
  M001210: "Greg Murphy",
  M001218: "Rich McCormick",
  M001226: "Rob Menendez",
  N000002: "Jerry Nadler",
  N000193: "Zach Nunn",
  O000175: "Andy Ogles",
  O000177: "Bob Onder",
  R000579: "Pat Ryan",
  S001201: "Tom Suozzi",
  S001214: "Greg Steube",
  T000165: "Tom Tiffany",
  T000463: "Mike Turner",
  V000138: "Eugene Vindman",
  W000804: "Rob Wittman",
};

// The Clerk uses AQ for American Samoa; everything else uses AS.
const STATE_FIXES = { AQ: "AS" };

const args = new Set(process.argv.slice(2));

async function get(url, as = "text") {
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return as === "buffer" ? Buffer.from(await response.arrayBuffer()) : response[as]();
}

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`));
  return match ? decode(match[1]).trim() : "";
}

/** "Hakeem S. Jeffries" -> "Hakeem Jeffries"; nickname wins when there is one. */
function displayName(id, official, last, nickname) {
  if (NAME_OVERRIDES[id]) return NAME_OVERRIDES[id];
  if (nickname) return `${nickname} ${last}`;
  return official
    .replace(/,?\s+(Jr\.|Sr\.|II|III|IV)$/, "")
    .split(/\s+/)
    .filter((word) => !/^[A-Z]\.$/.test(word) && !/^".*"$/.test(word))
    .join(" ");
}

async function buildRoster() {
  const [xml, legislators] = await Promise.all([get(CLERK_XML), get(LEGISLATORS, "json")]);
  const nicknames = Object.fromEntries(legislators.map((l) => [l.id.bioguide, l.name.nickname]));
  const published = xml.match(/publish-date="([^"]+)"/)?.[1];

  const members = [];
  const vacancies = [];
  for (const block of xml.split("<member>").slice(1)) {
    const seat = tag(block, "statedistrict");
    const state = STATE_FIXES[seat.slice(0, 2)] ?? seat.slice(0, 2);
    const number = Number(seat.slice(2));
    const id = tag(block, "bioguideID");
    if (!id) {
      vacancies.push(`${state}-${String(number).padStart(2, "0")}`);
      continue;
    }

    const districtText = tag(block, "district");
    const delegate = districtText === "Delegate" || districtText === "Resident Commissioner";
    const last = tag(block, "lastname");
    members.push({
      id,
      name: displayName(id, tag(block, "official-name"), last, nicknames[id]),
      district: `${state}-${number === 0 ? "AL" : String(number).padStart(2, "0")}`,
      party: tag(block, "party"),
      ...(delegate ? { delegate: true, role: districtText } : {}),
      sortName: tag(block, "sort-name"),
    });
  }

  // Alphabetical by state, then district; delegates last.
  members.sort(
    (a, b) =>
      Number(Boolean(a.delegate)) - Number(Boolean(b.delegate)) ||
      a.district.slice(0, 2).localeCompare(b.district.slice(0, 2)) ||
      a.district.localeCompare(b.district, undefined, { numeric: true }),
  );

  const lines = members.map(({ sortName, ...member }) => `  ${JSON.stringify(member)}`);
  writeFileSync(MEMBERS_JSON, `[\n${lines.join(",\n")}\n]\n`);
  console.log(`Clerk list published ${published}: ${members.length} members and delegates.`);
  console.log(`Vacant: ${vacancies.join(", ") || "none"}`);
  return members;
}

async function fetchPhotos(members) {
  mkdirSync(PHOTO_DIR, { recursive: true });
  const wanted = new Set(members.map((member) => `${member.id}.webp`));

  // Remove photos of members who have left.
  for (const file of readdirSync(PHOTO_DIR)) {
    if (!wanted.has(file)) rmSync(join(PHOTO_DIR, file));
  }

  const todo = members.filter((m) => args.has("--force-photos") || !existsSync(join(PHOTO_DIR, `${m.id}.webp`)));
  const missing = [];
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const member = todo[next++];
      try {
        const original = await get(PHOTO_URL(member.id), "buffer");
        // Official portraits are head-and-shoulders; a square from the top keeps the face.
        await sharp(original)
          .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover", position: "top" })
          .webp({ quality: 74 })
          .toFile(join(PHOTO_DIR, `${member.id}.webp`));
      } catch {
        missing.push(`${member.name} (${member.id})`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`Photos: ${todo.length - missing.length} downloaded, ${wanted.size - todo.length} already present.`);
  if (missing.length) console.log(`No official photo yet (initials shown instead): ${missing.join(", ")}`);
}

const members = args.has("--photos-only")
  ? JSON.parse(readFileSync(MEMBERS_JSON, "utf8"))
  : await buildRoster();
await fetchPhotos(members);
