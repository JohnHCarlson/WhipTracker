const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const Check = (props) => (
  <svg {...base} {...props}>
    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
  </svg>
);

export const ChevronDown = (props) => (
  <svg {...base} {...props}>
    <path d="M5.5 8l4.5 4.5L14.5 8" />
  </svg>
);

export const Close = (props) => (
  <svg {...base} {...props}>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
  </svg>
);

export const Search = (props) => (
  <svg {...base} {...props}>
    <circle cx="8.75" cy="8.75" r="5.25" />
    <path d="M12.75 12.75L16.5 16.5" />
  </svg>
);

export const Undo = (props) => (
  <svg {...base} {...props}>
    <path d="M7.5 5L4 8.5 7.5 12" />
    <path d="M4.5 8.5h7a4.5 4.5 0 010 9H9" />
  </svg>
);

export const Redo = (props) => (
  <svg {...base} {...props}>
    <path d="M12.5 5L16 8.5 12.5 12" />
    <path d="M15.5 8.5h-7a4.5 4.5 0 000 9H11" />
  </svg>
);

export const Sun = (props) => (
  <svg {...base} {...props}>
    <circle cx="10" cy="10" r="3.5" />
    <path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1.06 1.06M14.24 14.24l1.06 1.06M4.7 15.3l1.06-1.06M14.24 5.76l1.06-1.06" />
  </svg>
);

export const Moon = (props) => (
  <svg {...base} {...props}>
    <path d="M16 12.2A6.5 6.5 0 017.8 4a6.5 6.5 0 108.2 8.2z" />
  </svg>
);

export const Info = (props) => (
  <svg {...base} {...props}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 9v4.5" />
    <circle cx="10" cy="6.4" r="0.4" fill="currentColor" />
  </svg>
);

export const Filter = (props) => (
  <svg {...base} {...props}>
    <path d="M3.5 5.5h13M6 10h8M8.5 14.5h3" />
  </svg>
);

export const Reset = (props) => (
  <svg {...base} {...props}>
    <path d="M4 10a6 6 0 106-6 6.3 6.3 0 00-4.4 1.8L4 7.5" />
    <path d="M4 3.5v4h4" />
  </svg>
);

export const Warning = (props) => (
  <svg {...base} {...props}>
    <path d="M10 3.5l7 12.5H3z" />
    <path d="M10 8.5v3.5" />
    <circle cx="10" cy="14.2" r="0.4" fill="currentColor" />
  </svg>
);

export const Plus = (props) => (
  <svg {...base} {...props}>
    <path d="M10 4.5v11M4.5 10h11" />
  </svg>
);

export const ChevronLeft = (props) => (
  <svg {...base} {...props}>
    <path d="M12 5.5L7.5 10l4.5 4.5" />
  </svg>
);

export const More = (props) => (
  <svg {...base} {...props}>
    <circle cx="5" cy="10" r="0.9" fill="currentColor" />
    <circle cx="10" cy="10" r="0.9" fill="currentColor" />
    <circle cx="15" cy="10" r="0.9" fill="currentColor" />
  </svg>
);

export const People = (props) => (
  <svg {...base} {...props}>
    <circle cx="7.5" cy="7" r="2.75" />
    <path d="M2.75 16a4.75 4.75 0 019.5 0" />
    <path d="M12.5 4.6a2.75 2.75 0 010 4.8M14.25 11.6A4.75 4.75 0 0117.25 16" />
  </svg>
);

export const Copy = (props) => (
  <svg {...base} {...props}>
    <rect x="7" y="7" width="9" height="9" rx="2" />
    <path d="M13 4.5A1.5 1.5 0 0011.5 3h-6A2.5 2.5 0 003 5.5v6A1.5 1.5 0 004.5 13" />
  </svg>
);

export const Trash = (props) => (
  <svg {...base} {...props}>
    <path d="M4 6h12M8 6V4.5h4V6M5.5 6l.75 10h7.5L14.5 6" />
  </svg>
);

export const LinkIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M8.5 11.5a3 3 0 004.25 0l2.5-2.5a3 3 0 00-4.25-4.25l-.75.75" />
    <path d="M11.5 8.5a3 3 0 00-4.25 0l-2.5 2.5a3 3 0 004.25 4.25l.75-.75" />
  </svg>
);

export const Eye = (props) => (
  <svg {...base} {...props}>
    <path d="M2.5 10s2.75-5 7.5-5 7.5 5 7.5 5-2.75 5-7.5 5-7.5-5-7.5-5z" />
    <circle cx="10" cy="10" r="2.25" />
  </svg>
);

export const SignOut = (props) => (
  <svg {...base} {...props}>
    <path d="M8 4H5.5A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8" />
    <path d="M12 6.5L15.5 10 12 13.5M15.5 10H8" />
  </svg>
);

export const WifiOff = (props) => (
  <svg {...base} {...props}>
    <path d="M3 3l14 14" />
    <path d="M2.5 7.5a11 11 0 014-2.3M9 4.6a11 11 0 018.5 2.9M5 10.4a7 7 0 012.8-1.6M12.5 9a7 7 0 012.5 1.4M7.6 13.2a3.5 3.5 0 014.8 0" />
    <circle cx="10" cy="16" r="0.5" fill="currentColor" />
  </svg>
);
