import { kv } from "@vercel/kv";
import { createCookie } from "../lib/cookie.js";
import {
  getSessionFromRequest,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "../lib/session.js";

export const config = { runtime: "nodejs" };

function resolveMaxHeartRate(profile = {}) {
  const stored = Number(profile?.maxHeartRate);
  if (Number.isFinite(stored) && stored > 0) {
    return Math.round(stored);
  }

  const zones = profile?.zones;
  if (!Array.isArray(zones) || zones.length === 0) return null;

  const lastMax = Number(zones[zones.length - 1]?.max);
  if (Number.isFinite(lastMax) && lastMax > 0) {
    return Math.round(lastMax);
  }

  const candidates = zones
    .map((zone) => Number(zone?.max))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!candidates.length) return null;
  return Math.round(Math.max(...candidates));
}

const MAX_YEARLY_GOALS = 6;

function sanitizeYearlyGoals(goals) {
  if (!Array.isArray(goals)) return [];
  const cleaned = [];
  const seen = new Set();
  for (const goal of goals) {
    const sport = typeof goal?.sport === "string" ? goal.sport.trim() : "";
    const distance = Number(goal?.distanceKm ?? goal?.distance);
    if (!sport || !Number.isFinite(distance) || distance <= 0) {
      continue;
    }
    const key = sport.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      sport,
      distanceKm: Math.round(distance * 10) / 10,
    });
    if (cleaned.length >= MAX_YEARLY_GOALS) break;
  }
  return cleaned;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    res.setHeader("Allow", "GET, POST, DELETE");
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

    const profileKey = `atlo:profile:${userId}`;
    const profile = (await kv.get(profileKey)) || {};
    const maxHeartRate = resolveMaxHeartRate(profile);

    if (req.method === "DELETE") {
      await kv.del(profileKey);
      await kv.del(`strava:token:${state}`);
      await kv.del(sessionKey);

      const expiredCookie = createCookie(SESSION_COOKIE_NAME, "", { maxAge: 0 });
      res.setHeader("Set-Cookie", expiredCookie);
      return res.status(200).json({ success: true });
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const resting = Number(body?.restingHeartRate);
      const restingHeartRate =
        Number.isFinite(resting) && resting > 0 ? Math.round(resting) : null;
      const yearlyGoals =
        body && "yearlyGoals" in body
          ? sanitizeYearlyGoals(body?.yearlyGoals)
          : profile?.yearlyGoals || [];

      const nextProfile = {
        ...profile,
        restingHeartRate,
        maxHeartRate,
        yearlyGoals,
      };
      if ("zones" in nextProfile) {
        delete nextProfile.zones;
      }
      await kv.set(profileKey, nextProfile);
      return res.status(200).json({
        maxHeartRate,
        restingHeartRate,
        username: nextProfile?.username ?? null,
        yearlyGoals: nextProfile?.yearlyGoals || [],
      });
    }

    return res.status(200).json({
      maxHeartRate,
      restingHeartRate: profile?.restingHeartRate ?? null,
      username: profile?.username ?? null,
      yearlyGoals: profile?.yearlyGoals || [],
    });
  } catch (err) {
    console.error("Profile read error:", err);
    return res.status(500).send("Internal error");
  }
}
