const GAP_MS = 1400;
let lastStart = 0;
let inflight = 0;

export function offlineMessage() {
  return "No internet connection. Check your network and try again.";
}

export function canSend(): { ok: true } | { ok: false; error: string } {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, error: offlineMessage() };
  }
  if (inflight >= 2) {
    return { ok: false, error: "Please wait — a request is still running." };
  }
  if (Date.now() - lastStart < GAP_MS) {
    return { ok: false, error: "Please wait a moment before sending another request." };
  }
  return { ok: true };
}

export function beginRequest() {
  lastStart = Date.now();
  inflight += 1;
}

export function endRequest() {
  inflight = Math.max(0, inflight - 1);
}

export const CLIENT_TIMEOUT_MS = 40_000;
export const SLOW_AFTER_MS = 30_000;
