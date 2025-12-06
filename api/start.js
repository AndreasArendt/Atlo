import crypto from "node:crypto";

export const config = { runtime: "nodejs" };

function createCookie(name, value, { maxAge, secure } = {}) {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];

  if (maxAge) parts.push(`Max-Age=${maxAge}`);
  if (secure) parts.push("Secure");

  return parts.join("; ");
}

export default function handler(req, res) {
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    return res
      .status(500)
      .send(
        "Missing STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET environment variables."
      );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${process.env.BASE_URL}/api/strava`,
    approval_prompt: "auto",
    scope: "read,activity:read",
    state,
  });

  // Session binding: state in HttpOnly cookie to prevent cross-user leaks
  // Keep state cookie for 30 days to allow repeated API calls without re-auth
  const maxAge = 60 * 60 * 24 * 30;

  const isLocal =
    process.env.VERCEL_ENV === "development" ||
    process.env.NODE_ENV === "development";

  const cookie = createCookie("strava_state", state, {
    maxAge,
    secure: !isLocal,
  });

  res.setHeader("Set-Cookie", cookie);

  res.redirect("https://www.strava.com/oauth/authorize?" + params.toString());
}
