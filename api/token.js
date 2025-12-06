import { createClient } from "@vercel/kv";

export const config = { runtime: "nodejs" };

let cachedKv;

function getKvClient() {
  if (cachedKv) return cachedKv;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN;
  const missing = [];
  if (!url) missing.push("KV_REST_API_URL");
  if (!token) missing.push("KV_REST_API_TOKEN (or KV_REST_API_READ_ONLY_TOKEN)");

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }

  cachedKv = createClient({ url, token });
  return cachedKv;
}

export default async function handler(req, res) {
  try {
    const kv = getKvClient();

    const state = req.cookies?.strava_state;
    if (!state) return res.status(401).send("Missing session state.");

    const token = await kv.get(`strava:token:${state}`);
    if (!token) return res.status(404).send("Token not found; please re-authenticate.");

    return res.status(200).json(token);
  } catch (err) {
    if (err?.message?.startsWith("Missing env vars:")) {
      return res.status(500).send(err.message);
    }
    console.log("Token read error:", err.message);
    return res.status(500).send("Internal error");
  }
}
