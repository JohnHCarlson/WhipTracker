import { useEffect, useRef } from "react";
import { Close } from "./Icons";
import "./Dialog.css";

/**
 * A modal dialog on the browser's own <dialog>, which keeps focus inside and closes on Esc.
 * Clicking outside closes it too.
 */
function Dialog({ open, onClose, title, description, children, wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The browser would pick the close button; the first field is what people want.
      dialog.querySelector("input:not([type='hidden']):not([readonly]):not([hidden]), select, textarea")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? " wide" : ""}`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog-panel">
          <div className="dialog-head">
            <div className="dialog-heading">
              <h2 className="dialog-title">{title}</h2>
              {description && <p className="dialog-description">{description}</p>}
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              <Close width={18} height={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Asks before something that can't be undone. */
export function ConfirmDialog({ open, onClose, title, description, confirmLabel, onConfirm, danger = true }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={`button ${danger ? "danger" : "primary"}`}
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

export default Dialog;
