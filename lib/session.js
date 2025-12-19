import crypto from "node:crypto";
import { kv } from "@vercel/kv";

export const SESSION_COOKIE_NAME = "atlo_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function signSessionValue(session) {
  const hmac = crypto.createHmac("sha256", process.env.STRAVA_CLIENT_SECRET);
  hmac.update(session);
  return hmac.digest("base64url");
}

export function buildSessionCookieValue(session) {
  return `${session}.${signSessionValue(session)}`;
}

export function extractSessionFromCookie(cookieValue) {
  if (typeof cookieValue !== "string" || cookieValue.length === 0) {
    return null;
  }

  let value;
  try {
    // In case the cookie value was URL-encoded
    value = decodeURIComponent(cookieValue);
  } catch {
    return null;
  }

  // Split on the LAST dot to avoid truncating base64 signatures
  const idx = value.lastIndexOf(".");
  if (idx === -1) return null;

  const session = value.slice(0, idx);
  const signature = value.slice(idx + 1);
  if (!session || !signature) return null;

  try {
    const expectedSignature = signSessionValue(session);

    // Normalize Base64URL → Base64
    const normalizeBase64 = (s) =>
      s.replace(/-/g, "+").replace(/_/g, "/").padEnd(
        s.length + ((4 - (s.length % 4)) % 4),
        "="
      );

    const sigBuffer = Buffer.from(normalizeBase64(signature), "base64");
    const expectedBuffer = Buffer.from(
      normalizeBase64(expectedSignature),
      "base64"
    );

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req) {
  return extractSessionFromCookie(req.cookies?.[SESSION_COOKIE_NAME]);
}

export async function createSession(ttlSeconds = SESSION_TTL_SECONDS) {
  const state = crypto.randomBytes(16).toString("hex");
  await kv.set(`atlo:session:${state}`, { issuedAt: Date.now() }, { ex: ttlSeconds });
  return { state, expiresAt: Date.now() + ttlSeconds * 1000 };
}
