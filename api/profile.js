import { kv } from "@vercel/kv";
import { getSessionFromRequest, SESSION_TTL_SECONDS } from "../lib/session.js";

export const config = { runtime: "nodejs" };

function resolveMaxHeartRate(zones = []) {
  if (!Array.isArray(zones) || zones.length === 0) return null;

  const lastMax = Number(zones[zones.length - 1]?.max);
  if (Number.isFinite(lastMax) && lastMax > 0) {
    return lastMax;
  }

  const candidates = zones
    .map((zone) => Number(zone?.max))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!candidates.length) return null;
  return Math.max(...candidates);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  try {
    const state = getSessionFromRequest(req);
    if (!state) return res.status(401).send("Missing session state.");

    const sessionKey = `atlo:session:${state}`;
    const session = await kv.get(sessionKey);
    if (!session) {
      return res.status(401).send("Session expired; please authenticate.");
    }
    await kv.expire(sessionKey, SESSION_TTL_SECONDS);

    const userId = session.userId;
    if (!userId) {
      return res.status(404).send("Profile not found.");
    }

    const profile = await kv.get(`atlo:profile:${userId}`);
    if (!profile) {
      return res.status(404).send("Profile not found.");
    }

    const maxHeartRate = resolveMaxHeartRate(profile?.zones);
    return res.status(200).json({ maxHeartRate });
  } catch (err) {
    console.error("Profile read error:", err);
    return res.status(500).send("Internal error");
  }
}
