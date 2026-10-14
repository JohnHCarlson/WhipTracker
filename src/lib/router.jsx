import { useSyncExternalStore } from "react";

// The few addresses the app has (/, /v/<id>, /people, /invite/<token>), without a router
// library. The server sends the app for any of them.

let path = window.location.pathname;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

window.addEventListener("popstate", () => {
  path = window.location.pathname;
  emit();
});

export const usePath = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => path,
  );

export function navigate(to, { replace = false } = {}) {
  if (to === path) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", to);
  path = to;
  emit();
  window.scrollTo(0, 0);
}

/** A link within the app. Ctrl/⌘-click and middle-click still open a new tab. */
export function Link({ to, onClick, ...props }) {
  return (
    <a
      href={to}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(to);
      }}
      {...props}
    />
  );
}
