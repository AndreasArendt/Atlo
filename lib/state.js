import crypto from "node:crypto";

export const STATE_COOKIE_NAME = "strava_state";
export const STATE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getStateSecret() {
  const secret = process.env.STRAVA_STATE_SECRET || process.env.STRAVA_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Missing STRAVA_STATE_SECRET (or STRAVA_CLIENT_SECRET) for signing state cookies.");
  }
  return secret;
}

export function signStateValue(state) {
  const hmac = crypto.createHmac("sha256", getStateSecret());
  hmac.update(state);
  return hmac.digest("base64url");
}

export function buildStateCookieValue(state) {
  return `${state}.${signStateValue(state)}`;
}

export function extractStateFromCookie(cookieValue) {
  if (!cookieValue) return null;
  const [state, signature] = cookieValue.split(".");
  if (!state || !signature) return null;
  try {
    const expected = signStateValue(state);
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function getStateFromRequest(req) {
  return extractStateFromCookie(req.cookies?.[STATE_COOKIE_NAME]);
}
