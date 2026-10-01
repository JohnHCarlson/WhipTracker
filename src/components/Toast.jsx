import { useEffect } from "react";
import "./Toast.css";

function Toast({ toast, onUndo, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="toast glass" role="status" key={toast.id}>
      <span>{toast.message}</span>
      <button
        type="button"
        className="link-button"
        onClick={() => {
          onUndo();
          onDismiss();
        }}
      >
        Undo
      </button>
    </div>
  );
}

export default Toast;
