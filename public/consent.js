import { els } from "./dom.js";

export const COOKIE_CONSENT_KEY = "atlo_cookie_consent_v1";
const PRIVACY_POLICY_KEY = "atlo_privacy_policy_seen";
const PRIVACY_POLICY_VERSION = "2026-01-24";

function persistCookieChoice(value) {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // Ignore storage errors (e.g., Safari private mode)
  }
}

export function initCookieBanner() {
  if (!els.cookieBanner) {
    return Promise.resolve(false);
  }

  let stored = null;
  try {
    stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    stored = null;
  }

  if (stored === "accepted") {
    els.cookieBanner.hidden = true;
    return Promise.resolve(true);
  }

  els.cookieBanner.hidden = false;

  const privacyLink = els.cookieBanner.querySelector("a.ghost");
  if (privacyLink) {
    privacyLink.setAttribute("rel", "noreferrer");
  }

  return new Promise((resolve) => {
    const acceptHandler = () => {
      persistCookieChoice("accepted");
      els.cookieBanner.hidden = true;

      els.cookieAccept?.removeEventListener("click", acceptHandler);
      resolve(true);
    };

    els.cookieAccept?.addEventListener("click", acceptHandler);
  });
}

export function initPrivacyBanner() {
  if (!els.privacyBanner) {
    return;
  }

  let stored = null;
  try {
    stored = window.localStorage.getItem(PRIVACY_POLICY_KEY);
  } catch {
    stored = null;
  }

  if (stored === PRIVACY_POLICY_VERSION) {
    els.privacyBanner.hidden = true;
    return;
  }

  els.privacyBanner.hidden = false;

  const privacyLink = els.privacyBanner.querySelector("a.ghost");
  if (privacyLink) {
    privacyLink.setAttribute("rel", "noreferrer");
  }

  const acceptHandler = () => {
    try {
      window.localStorage.setItem(PRIVACY_POLICY_KEY, PRIVACY_POLICY_VERSION);
    } catch {
      // ignore storage errors
    }
    els.privacyBanner.hidden = true;
    els.privacyAccept?.removeEventListener("click", acceptHandler);
  };

  els.privacyAccept?.addEventListener("click", acceptHandler);
}

export function clearLocalStateForDev() {
  try {
    window.localStorage.clear();
  } catch {
    window.localStorage.removeItem(COOKIE_CONSENT_KEY);
    window.localStorage.removeItem(PRIVACY_POLICY_KEY);
  }
}
