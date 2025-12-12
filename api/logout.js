import { kv } from "@vercel/kv";
import { createCookie } from "../lib/cookie.js";
import { getSessionFromRequest, SESSION_COOKIE_NAME } from "../lib/session.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const state = getSessionFromRequest(req);
    if (!state) return res.status(401).send("Missing session state.");

    await kv.del(`strava:token:${state}`);
    await kv.del(`atlo:session:${state}`);

    const expiredCookie = createCookie(SESSION_COOKIE_NAME, "", { maxAge: 0 });
    res.setHeader("Set-Cookie", expiredCookie);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Logout failed:", err);
    return res.status(500).send("Failed to log out.");
  }
}
