import { createCookie } from "../lib/cookie.js";
import { kv } from "@vercel/kv";
import {
  buildSessionCookieValue,
  createSession,
  getSessionFromRequest,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS
} from "../lib/session.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    return res
      .status(500)
      .send(
        "Missing STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET environment variables."
      );
  }

  let state = getSessionFromRequest(req);

  if (state) {
    const sessionKey = `atlo:session:${state}`;
    const existing = await kv.get(sessionKey);
    if (!existing) {
      const session = await createSession(SESSION_TTL_SECONDS);
      state = session.state;
    } else {
      await kv.expire(sessionKey, SESSION_TTL_SECONDS);
    }
  } else {
    const session = await createSession(SESSION_TTL_SECONDS);
    state = session.state;
  }

  const cookieValue = buildSessionCookieValue(state);

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${process.env.BASE_URL}/api/auth`,
    approval_prompt: "auto",
    scope: "read,activity:read,profile:read_all",
    state,
  });

  // Try to ensure the cookie covers both apex and www
  const host = req.headers.host;
  let cookieDomain = process.env.COOKIE_DOMAIN;
  if (!cookieDomain && host) {
    const hostname = host.split(":")[0];
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      cookieDomain = `.${hostname.replace(/^www\./, "")}`;
    }
  }

  const isLocal =
    process.env.VERCEL_ENV === "development" ||
    process.env.NODE_ENV === "development" ||
    host === "localhost" ||
    host?.startsWith("localhost:") ||
    host === "127.0.0.1" ||
    host?.startsWith("127.0.0.1:");

  const cookie = createCookie(SESSION_COOKIE_NAME, cookieValue, {
    maxAge: SESSION_TTL_SECONDS,
    sameSite: isLocal ? "Lax" : "None", // None requires Secure; local dev uses Lax over http
    secure: !isLocal,
    domain: cookieDomain,
  });

  res.setHeader("Set-Cookie", cookie);
  res.redirect("https://www.strava.com/oauth/authorize?" + params.toString());
}
