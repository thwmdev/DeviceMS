import { useCallback, useMemo, useRef, useState } from "react";
import { ConfirmContext } from "./confirmContext";

export function ConfirmProvider({ children }) {
  const resolverRef = useRef(null);
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        tone: "warning",
        title: "Xác nhận thao tác",
        message: "Bạn có chắc chắn muốn tiếp tục?",
        confirmText: "Xác nhận",
        cancelText: "Hủy",
        ...options,
      });
    });
  }, []);

  const close = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog && (
        <div className="confirm-backdrop" role="presentation" onMouseDown={() => close(false)}>
          <section
            className={`confirm-dialog confirm-dialog-${dialog.tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="confirm-mark" aria-hidden="true">
              {dialog.tone === "danger" ? "!" : "?"}
            </div>
            <div className="confirm-copy">
              <p className="confirm-eyebrow">{dialog.eyebrow || "Cần xác nhận"}</p>
              <h2 id="confirm-dialog-title">{dialog.title}</h2>
              <p>{dialog.message}</p>
              {dialog.details && <div className="confirm-details">{dialog.details}</div>}
            </div>
            <div className="confirm-actions">
              <button type="button" className="confirm-cancel" onClick={() => close(false)}>
                {dialog.cancelText}
              </button>
              <button type="button" className="confirm-accept" onClick={() => close(true)} autoFocus>
                {dialog.confirmText}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
