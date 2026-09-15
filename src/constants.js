export const voteLabels = {
  yes: "Yes",
  no: "No",
  present: "Present",
};

export const voteOrder = ["yes", "no", "present"];

export const groupOptions = ["CBC", "CHC", "CAPAC", "BDC", "NDC", "CPC", "PSC", "RGG", "HFC"];

export const voteTypes = [
  { id: "simple-majority", label: "Simple majority", description: "More yea than nay; present ignored" },
  { id: "absolute-majority", label: "Absolute majority", description: "More than 50% + 1 of total voting members" },
  { id: "simple-supermajority", label: "Simple supermajority", description: "More than 2/3 yea over nay; present ignored" },
  { id: "absolute-supermajority", label: "Absolute supermajority", description: "More than 2/3 of all voting members" },
];

export const STORAGE_KEY = "whip-tracker-members";
