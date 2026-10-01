import { useEffect, useRef, useState } from "react";
import { VOTE_TYPES, VOTE_TYPE_GROUPS } from "../lib/voteTypes";
import { Check, ChevronDown } from "./Icons";
import "./VoteTypePicker.css";

function VoteTypePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const current = VOTE_TYPES.find((type) => type.id === value);

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector("[aria-checked='true']")?.focus();

    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        rootRef.current?.querySelector(".picker-button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKeyDown = (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(menuRef.current.querySelectorAll("[role='menuitemradio']"));
    const index = items.indexOf(document.activeElement);
    const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next].focus();
  };

  const choose = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="picker" ref={rootRef}>
      <button
        type="button"
        className="picker-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span className="picker-value">{current.name}</span>
        <ChevronDown className="picker-chevron" />
      </button>

      {open && (
        <div className="picker-menu" role="menu" aria-label="Vote type" ref={menuRef} onKeyDown={onMenuKeyDown}>
          {VOTE_TYPE_GROUPS.map((group) => (
            <div className="picker-group" key={group.id} role="group" aria-label={group.label}>
              <div className="picker-group-label">{group.label}</div>
              {VOTE_TYPES.filter((type) => type.group === group.id).map((type) => (
                <button
                  type="button"
                  key={type.id}
                  role="menuitemradio"
                  aria-checked={type.id === value}
                  className="picker-item"
                  onClick={() => choose(type.id)}
                >
                  <span className="picker-check">{type.id === value && <Check width={16} height={16} />}</span>
                  <span className="picker-item-text">
                    <span className="picker-item-name">{type.name}</span>
                    <span className="picker-item-summary">{type.summary}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VoteTypePicker;
