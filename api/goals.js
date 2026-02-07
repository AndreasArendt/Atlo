import { kv } from "@vercel/kv";
import { getSessionFromRequest, SESSION_TTL_SECONDS } from "../lib/session.js";

export const config = { runtime: "nodejs" };

const GOAL_SPORTS = [
  "Run",
  "Ride",
  "Swim",
  "Hike",
  "Walk",
  "Row",
  "Workout",
  "Other",
];

const SPORT_BY_ID = new Map(
  GOAL_SPORTS.map((sport) => [sport.toLowerCase(), sport])
);

const PERIODS = new Set(["week", "month", "year"]);
const GOAL_DISTANCE_LIMITS = { min: 1, max: 100000 };

function sanitizeGoal(goal) {
  if (!goal || typeof goal !== "object") return null;
  const rawSport = (goal.sportId || "").toString().trim().toLowerCase();
  if (!SPORT_BY_ID.has(rawSport)) return null;
  const targetKm = Number(goal.targetKm);
  if (
    !Number.isFinite(targetKm) ||
    targetKm < GOAL_DISTANCE_LIMITS.min ||
    targetKm > GOAL_DISTANCE_LIMITS.max
  ) {
    return null;
  }
  const period = (goal.period || "").toString().trim().toLowerCase();
  if (!PERIODS.has(period)) return null;

  const id =
    typeof goal.id === "string" && goal.id.trim()
      ? goal.id.trim()
      : `goal_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const createdAt = Number(goal.createdAt);

  return {
    id,
    sportId: SPORT_BY_ID.get(rawSport),
    targetKm,
    period,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  };
}

function sanitizeGoalList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((goal) => sanitizeGoal(goal)).filter(Boolean);
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

async function getUserId(req, res) {
  const state = getSessionFromRequest(req);
  if (!state) {
    res.status(401).send("Missing session state.");
    return null;
  }

  const sessionKey = `atlo:session:${state}`;
  const session = await kv.get(sessionKey);
  if (!session) {
    res.status(401).send("Session expired; please authenticate.");
    return null;
  }

  await kv.expire(sessionKey, SESSION_TTL_SECONDS);

  const userId = session.userId;
  if (!userId) {
    res.status(404).send("Profile not found.");
    return null;
  }

  return userId;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).send("Method not allowed");
  }

  try {
    const userId = await getUserId(req, res);
    if (!userId) return;

    const goalsKey = `atlo:goals:${userId}`;

    if (req.method === "DELETE") {
      await kv.del(goalsKey);
      return res.status(200).json({ success: true });
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const sanitized = sanitizeGoalList(body?.goals);
      await kv.set(goalsKey, sanitized);
      return res.status(200).json(sanitized);
    }

    const stored = await kv.get(goalsKey);
    const sanitized = sanitizeGoalList(stored);
    return res.status(200).json(sanitized);
  } catch (err) {
    console.error("Goals API error:", err);
    return res.status(500).send("Internal error");
  }
}
