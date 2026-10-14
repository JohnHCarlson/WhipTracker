import { useEffect, useState } from "react";

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const yearFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** "just now", "5 min ago", "3 hr ago", "yesterday", "Oct 12". */
export function formatAgo(iso, now = Date.now()) {
  const then = Date.parse(iso);
  const minutes = Math.floor(Math.max(0, now - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  if (hours < 48) return "yesterday";
  return new Date(then).getFullYear() === new Date(now).getFullYear() ? dayFmt.format(then) : yearFmt.format(then);
}

export const formatDay = (iso) => dayFmt.format(Date.parse(iso));

/** Current time, ticking every 30 seconds, for "5 min ago" labels. */
export function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
