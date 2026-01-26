export const GOAL_SPORTS = [
  {
    id: "Run",
    label: "Run",
    icon: "fa-person-running",
    match: ["run", "trailrun", "virtualrun", "treadmill"],
  },
  {
    id: "Ride",
    label: "Ride",
    icon: "fa-person-biking",
    match: ["ride", "virtualride", "ebikeride", "bike"],
  },
  {
    id: "Swim",
    label: "Swim",
    icon: "fa-person-swimming",
    match: ["swim"],
  },
  {
    id: "Hike",
    label: "Hike",
    icon: "fa-person-hiking",
    match: ["hike"],
  },
  {
    id: "Walk",
    label: "Walk",
    icon: "fa-person-walking",
    match: ["walk"],
  },
  {
    id: "Row",
    label: "Row",
    icon: "fa-person-rowing",
    match: ["row"],
  },
  {
    id: "Workout",
    label: "Workout",
    icon: "fa-dumbbell",
    match: ["workout", "training", "weighttraining"],
  },
  {
    id: "Other",
    label: "Other",
    icon: "fa-flag-checkered",
    match: [],
  },
];

const SPORT_BY_ID = new Map(
  GOAL_SPORTS.map((sport) => [sport.id.toLowerCase(), sport])
);

export function getSportMeta(sportId) {
  if (!sportId) return SPORT_BY_ID.get("other");
  const key = sportId.toString().trim().toLowerCase();
  return SPORT_BY_ID.get(key) || SPORT_BY_ID.get("other");
}

export function normalizeSport(type) {
  const raw = type ? type.toString().toLowerCase() : "";
  const cleaned = raw.replace(/[^a-z]/g, "");
  if (!cleaned) return "Other";

  for (const sport of GOAL_SPORTS) {
    if (cleaned === sport.id.toLowerCase()) return sport.id;
    for (const match of sport.match) {
      if (cleaned.includes(match.replace(/[^a-z]/g, ""))) return sport.id;
    }
  }

  return "Other";
}
