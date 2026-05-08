const TOAST_EVENT_NAME = "xtracker-toast";
const TOAST_QUEUE_KEY = "xtracker-toast-queue";

function normalizeToast(toast = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    duration: Number(toast.duration) > 0 ? Number(toast.duration) : 4200,
    message: typeof toast.message === "string" ? toast.message : "",
    title: typeof toast.title === "string" ? toast.title : "",
    type: ["success", "error", "info", "warning"].includes(toast.type) ? toast.type : "info"
  };
}

export function getToastEventName() {
  return TOAST_EVENT_NAME;
}

export function showToast(toast) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(TOAST_EVENT_NAME, {
    detail: normalizeToast(toast)
  }));
}

export function queueToast(toast) {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(TOAST_QUEUE_KEY, JSON.stringify(normalizeToast(toast)));
  } catch (error) {
    showToast(toast);
  }
}

export function popQueuedToast() {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return null;
  }

  try {
    const rawToast = window.sessionStorage.getItem(TOAST_QUEUE_KEY);
    window.sessionStorage.removeItem(TOAST_QUEUE_KEY);
    return rawToast ? JSON.parse(rawToast) : null;
  } catch (error) {
    return null;
  }
}
