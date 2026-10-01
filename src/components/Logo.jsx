// A hemicycle: two rings of seats, yeas filling from the left and nays from the right.
// The same shape lives in public/favicon.svg with fixed colors.
const SEATS = [
  ["yes", "M6.1 21.4A9.9 9.9 0 0 1 6.83 17.68"],
  ["yes", "M7.37 16.55A9.9 9.9 0 0 1 9.35 14.06"],
  ["yes", "M10.33 13.29A9.9 9.9 0 0 1 13.19 11.91"],
  ["yes", "M14.41 11.63A9.9 9.9 0 0 1 17.59 11.63"],
  ["open", "M18.81 11.91A9.9 9.9 0 0 1 21.67 13.29"],
  ["no", "M22.65 14.06A9.9 9.9 0 0 1 24.63 16.55"],
  ["no", "M25.17 17.68A9.9 9.9 0 0 1 25.9 21.4"],
  ["yes", "M10.6 21.4A5.4 5.4 0 0 1 11.29 18.75"],
  ["yes", "M12.03 17.74A5.4 5.4 0 0 1 13.75 16.49"],
  ["open", "M14.94 16.11A5.4 5.4 0 0 1 17.06 16.11"],
  ["no", "M18.25 16.49A5.4 5.4 0 0 1 19.97 17.74"],
  ["no", "M20.71 18.75A5.4 5.4 0 0 1 21.4 21.4"],
];

function Logo({ size = 28 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect className="logo-tile" width="32" height="32" rx="8" />
      {SEATS.map(([kind, d]) => (
        <path key={d} className={`logo-seat ${kind}`} d={d} />
      ))}
    </svg>
  );
}

export default Logo;
