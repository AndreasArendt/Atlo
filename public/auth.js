import { showStatusMessage, hideStatusSpinner } from "./ui.js";
import { els } from "./dom.js";
import { state } from "./state.js";

const STRAVA_BUTTON_IMG = `<img src="/btn_strava_connect_with_orange.svg" alt="Connect with Strava" />`;
const POLL_INTERVAL_MS = 2500;

function setConnectAttention(active) {
  if (!els.connect) return;
  els.connect.classList.toggle("need-auth", Boolean(active));
}

function renderConnectButton() {
  if (!els.connect) return;
  els.connect.classList.add("btn-strava");
  els.connect.classList.add("cookie-consent-given");
  els.connect.classList.remove("btn-logout");
  els.connect.innerHTML = STRAVA_BUTTON_IMG;
  els.connect.setAttribute("aria-label", "Connect with Strava");
}

function setAuthPending(pending) {
  if (els.connect) els.connect.hidden = pending;
  if (els.profileMenu) els.profileMenu.hidden = pending;
  if (els.logout) els.logout.hidden = pending;
}

function setAuthRequiredVisibility(authenticated) {
  document.querySelectorAll("[data-auth-required]").forEach((el) => {
    el.hidden = !authenticated;
  });
}

export function updateAuthUI(authenticated) {
  state.isAuthenticated = authenticated;
  renderConnectButton();
  setAuthPending(false);
  setConnectAttention(!authenticated);
  setAuthRequiredVisibility(authenticated);
  if (els.profileMenu) {
    els.profileMenu.hidden = !authenticated;
  }
  if (els.connect) {
    els.connect.hidden = authenticated;
  }
}

export function handleAuthRequired(message) {
  updateAuthUI(false);
  showStatusMessage(
    message || "Connect Strava to load your activities.",
    "var(--muted)"
  );
}

export async function ensureSessionCookie() {
  const res = await fetch("/api/session", {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json().catch(() => ({}));
}

export async function checkAuthStatus() {
  try {
    const res = await fetch("/api/token", { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

function stopAuthPolling() {
  if (state.authPollTimer) {
    clearInterval(state.authPollTimer);
    state.authPollTimer = null;
  }
}

function startAuthPolling(onAuthenticated) {
  if (state.authPollTimer) return;
  state.authPollTimer = window.setInterval(async () => {
    const authed = await checkAuthStatus();
    if (authed) {
      stopAuthPolling();
      updateAuthUI(true);
      hideStatusSpinner();
      onAuthenticated?.();
    }
  }, POLL_INTERVAL_MS);
}

function startAuthFlow(event, onAuthenticated) {
  event?.preventDefault();
  const popup = window.open(
    "/api/start",
    "strava-auth",
    "width=640,height=760"
  );
  showStatusMessage(
    "Complete the authentication popup, then return here.",
    "var(--muted)"
  );
  if (popup) {
    popup.focus();
    startAuthPolling(onAuthenticated);
  } else {
    window.location.href = "/api/start";
  }
}

async function handleLogout(event, onLogout) {
  event?.preventDefault();
  showStatusMessage("Logging out...", "var(--muted)");
  try {
    const res = await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error(await res.text());
    updateAuthUI(false);
    showStatusMessage("Logged out.", "var(--muted)");
  } catch (err) {
    console.error("Logout failed:", err);
    showStatusMessage(err.message || "Failed to log out.", "var(--error)");
  } finally {
    stopAuthPolling();
    onLogout?.();
  }
}

export function bindConnectButton({ onAuthenticated, onLogout }) {
  if (!els.connect) return;
  renderConnectButton();
  setAuthPending(true);
  els.connect.addEventListener("click", (event) => {
    startAuthFlow(event, onAuthenticated);
  });
  els.logout?.addEventListener("click", (event) =>
    handleLogout(event, onLogout)
  );
}
