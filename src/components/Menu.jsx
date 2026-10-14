import { useEffect, useRef, useState } from "react";
import "./Menu.css";

/**
 * A button that opens a short list of actions. `items`: [{ label, icon, onSelect, danger }],
 * with falsy entries skipped so callers can write `canManage && {...}`. `header` shows above them.
 */
function Menu({ label, icon, items, align = "end", className = "icon-button", header, children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const shown = items.filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector("button")?.focus();
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        rootRef.current?.querySelector(".menu-trigger")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const onMenuKeyDown = (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(menuRef.current.querySelectorAll("button"));
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  if (!shown.length) return null;

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className={`menu-trigger ${className}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={children ? undefined : label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((isOpen) => !isOpen);
        }}
      >
        {icon}
        {children}
      </button>
      {open && (
        <div className={`menu-list align-${align}`} role="menu" ref={menuRef} onKeyDown={onMenuKeyDown}>
          {header}
          {shown.map((item) => (
            <button
              type="button"
              role="menuitem"
              key={item.label}
              className={`menu-item${item.danger ? " danger" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Menu;
