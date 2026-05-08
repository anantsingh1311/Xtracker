import { useEffect, useState } from "react";
import { getToastEventName, popQueuedToast } from "../utils/toast";

const TOAST_STYLES = {
  error: {
    accent: "bg-rose-500",
    label: "Error",
    ring: "ring-rose-100"
  },
  info: {
    accent: "bg-cyan-500",
    label: "Info",
    ring: "ring-cyan-100"
  },
  success: {
    accent: "bg-emerald-500",
    label: "Success",
    ring: "ring-emerald-100"
  },
  warning: {
    accent: "bg-amber-400",
    label: "Notice",
    ring: "ring-amber-100"
  }
};

function ToastItem({ onDismiss, toast }) {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;

  return (
    <div
      className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-4 ${style.ring}`}
      role={toast.type === "error" ? "alert" : "status"}
    >
      <div className="flex gap-3 p-4">
        <span className={`mt-1 h-3 w-3 shrink-0 rounded-3xl ${style.accent}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            {toast.title || style.label}
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">
            {toast.message}
          </p>
        </div>
        <button
          aria-label="Dismiss notification"
          className="rounded-xl px-2 text-lg font-black leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
          onClick={() => onDismiss(toast.id)}
          type="button"
        >
          x
        </button>
      </div>
    </div>
  );
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const addToast = (toast) => {
      if (!toast?.message) {
        return;
      }

      setToasts((currentToasts) => [...currentToasts, toast].slice(-4));

      window.setTimeout(() => {
        setToasts((currentToasts) => currentToasts.filter((item) => item.id !== toast.id));
      }, toast.duration);
    };

    const handleToast = (event) => {
      addToast(event.detail);
    };

    window.addEventListener(getToastEventName(), handleToast);

    const queuedToast = popQueuedToast();
    if (queuedToast) {
      window.setTimeout(() => addToast(queuedToast), 100);
    }

    return () => {
      window.removeEventListener(getToastEventName(), handleToast);
    };
  }, []);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          onDismiss={(toastId) => setToasts((currentToasts) => currentToasts.filter((item) => item.id !== toastId))}
          toast={toast}
        />
      ))}
    </div>
  );
}
