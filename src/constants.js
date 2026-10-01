export const VOTE_OPTIONS = ["yes", "no", "other", "present"];

export const PARTIES = {
  D: { name: "Democrats", short: "D" },
  R: { name: "Republicans", short: "R" },
  I: { name: "Independents", short: "I" },
};

export const CAUCUSES = {
  BDC: { name: "Blue Dog Coalition" },
  CAPAC: { name: "Asian Pacific American Caucus" },
  CBC: { name: "Congressional Black Caucus" },
  CHC: { name: "Congressional Hispanic Caucus" },
  CPC: { name: "Progressive Caucus" },
  NDC: { name: "New Democrat Coalition" },
};

export const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia", PR: "Puerto Rico", GU: "Guam", VI: "U.S. Virgin Islands",
  AS: "American Samoa", MP: "Northern Mariana Islands",
};

/** DC and the territories: represented by delegates, not counted as states. */
export const TERRITORIES = ["DC", "PR", "GU", "VI", "AS", "MP"];
export const STATES = Object.keys(STATE_NAMES).filter((code) => !TERRITORIES.includes(code));

export const STORAGE_KEY = "whip-tracker:v2";
export const LEGACY_STORAGE_KEY = "whip-tracker-members";
