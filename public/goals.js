import { api } from "./api.js";

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

const PERIODS = [
  { id: "week", label: "Weekly", meta: "This week" },
  { id: "month", label: "Monthly", meta: "This month" },
  { id: "year", label: "Yearly", meta: "This year" },
];

const PERIOD_BY_ID = new Map(PERIODS.map((period) => [period.id, period]));

const GOAL_STORAGE_KEY = "atlo.goals.v2";
const LEGACY_GOAL_KEY = "atlo.goal.v1";
const GOAL_DISTANCE_LIMITS = { min: 1, max: 100000 };
const GOAL_API_PATH = "/api/goals";

let goals = [];
let goalLoaded = false;
let goalEls = null;
let lastActivities = [];
let lastRangeStart = null;
let lastRangeEnd = null;
let currentEditId = null;
let goalSyncPromise = null;

const periodCache = new Map();
const pendingPeriod = new Map();
let scrollRaf = null;

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

function ensureGoalLoaded() {
  if (goalLoaded) return;
  goals = loadGoals();
  goalLoaded = true;
}

function loadGoals() {
  const parsed = loadGoalListFromStorage(GOAL_STORAGE_KEY);
  if (parsed.length) return parsed;

  const legacy = loadLegacyGoal();
  if (legacy) {
    const migrated = [legacy];
    saveGoals(migrated);
    return migrated;
  }

  return [];
}

function loadGoalListFromStorage(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((goal) => sanitizeGoal(goal))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function loadLegacyGoal() {
  try {
    const raw = window.localStorage.getItem(LEGACY_GOAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const goal = sanitizeGoal({
      ...parsed,
      period: "year",
    });
    return goal;
  } catch {
    return null;
  }
}

function sanitizeGoal(goal) {
  if (!goal || typeof goal !== "object") return null;
  const rawSport = (goal.sportId || "").toString().trim().toLowerCase();
  if (!SPORT_BY_ID.has(rawSport)) return null;
  const targetKm = Number(goal.targetKm);
  if (!Number.isFinite(targetKm) || targetKm <= 0) return null;
  const period = (goal.period || "").toString().toLowerCase();
  if (!PERIOD_BY_ID.has(period)) return null;
  return {
    id: goal.id || `goal_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    sportId: SPORT_BY_ID.get(rawSport).id,
    targetKm,
    period,
    createdAt: goal.createdAt || Date.now(),
  };
}

function saveGoals(nextGoals) {
  goals = Array.isArray(nextGoals) ? nextGoals : [];
  try {
    window.localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // ignore storage errors
  }
  persistGoalsToServer(goals);
}

function saveGoalsToStorage(nextGoals) {
  goals = Array.isArray(nextGoals) ? nextGoals : [];
  try {
    window.localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // ignore storage errors
  }
}

async function persistGoalsToServer(nextGoals) {
  if (!Array.isArray(nextGoals)) return false;
  try {
    await api(GOAL_API_PATH, {
      method: "POST",
      body: { goals: nextGoals },
    });
    return true;
  } catch (err) {
    console.warn("Goal save failed:", err?.message || err);
    return false;
  }
}

async function fetchGoalsFromServer() {
  try {
    const data = await api(GOAL_API_PATH);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Goal load failed:", err?.message || err);
    return null;
  }
}

export async function syncGoalsFromServer() {
  if (goalSyncPromise) return goalSyncPromise;
  goalSyncPromise = (async () => {
    const remote = await fetchGoalsFromServer();
    if (!remote) return null;

    const sanitizedRemote = remote.map((goal) => sanitizeGoal(goal)).filter(Boolean);
    const local = loadGoalListFromStorage(GOAL_STORAGE_KEY);
    if (!sanitizedRemote.length && local.length) {
      const sanitizedLocal = local.map((goal) => sanitizeGoal(goal)).filter(Boolean);
      if (sanitizedLocal.length) {
        const saved = await persistGoalsToServer(sanitizedLocal);
        if (saved) {
          saveGoalsToStorage(sanitizedLocal);
          return sanitizedLocal;
        }
      }
    }

    saveGoalsToStorage(sanitizedRemote);
    return sanitizedRemote;
  })().finally(() => {
    goalSyncPromise = null;
  });

  const result = await goalSyncPromise;
  if (Array.isArray(result)) {
    updateGoalCard({
      activities: lastActivities,
      rangeStart: lastRangeStart,
      rangeEnd: lastRangeEnd,
    }).catch(() => null);
  }
  return result;
}

function getGoalElements() {
  if (goalEls) return goalEls;
  const card = document.querySelector(".goal-card");
  const modal = document.querySelector("[data-goal-modal]");
  if (!card) return null;

  goalEls = {
    card,
    meta: card.querySelector("[data-goal-meta]"),
    note: card.querySelector("[data-goal-note]"),
    toggle: card.querySelector("[data-goal-toggle]"),
    editActive: card.querySelector("[data-goal-edit-active]"),
    deleteActive: card.querySelector("[data-goal-delete-active]"),
    carousel: card.querySelector("[data-goal-carousel]"),
    prev: card.querySelector("[data-goal-prev]"),
    next: card.querySelector("[data-goal-next]"),
    modal,
    backdrop: modal?.querySelector("[data-goal-backdrop]"),
    close: modal?.querySelector("[data-goal-close]"),
    form: modal?.querySelector("[data-goal-form]"),
    id: modal?.querySelector("[data-goal-id]"),
    sport: modal?.querySelector("[data-goal-sport]"),
    target: modal?.querySelector("[data-goal-target]"),
    period: modal?.querySelector("[data-goal-period]"),
    cancel: modal?.querySelector("[data-goal-cancel]"),
    clear: modal?.querySelector("[data-goal-clear]"),
    status: modal?.querySelector("[data-goal-status]"),
    title: modal?.querySelector("#goal-modal-title"),
  };

  return goalEls;
}

function populateSportOptions(selectEl) {
  if (!selectEl) return;
  if (selectEl.options?.length) return;
  GOAL_SPORTS.forEach((sport) => {
    const option = document.createElement("option");
    option.value = sport.id;
    option.textContent = sport.label;
    selectEl.appendChild(option);
  });
}

function setFormStatus(message, tone = "muted") {
  if (!goalEls?.status) return;
  goalEls.status.textContent = message || "";
  if (message) {
    goalEls.status.dataset.tone = tone;
  } else {
    delete goalEls.status.dataset.tone;
  }
}

function setGoalFormValues(goal) {
  if (!goalEls?.sport || !goalEls?.target || !goalEls?.period) return;
  populateSportOptions(goalEls.sport);
  const fallbackSport = GOAL_SPORTS.find((item) => item.id === "Run")?.id;
  goalEls.sport.value = goal?.sportId || fallbackSport || GOAL_SPORTS[0]?.id || "Run";
  goalEls.target.value = goal?.targetKm ? String(goal.targetKm) : "";
  goalEls.period.value = goal?.period || "year";
  if (goalEls.id) {
    goalEls.id.value = goal?.id || "";
  }
}

function formatKmValue(km, { allowZero = false } = {}) {
  const numeric = Number(km);
  if (!Number.isFinite(numeric)) return "-";
  if (!allowZero && numeric <= 0) return "-";
  if (allowZero && numeric < 0) return "-";
  if (numeric === 0) return "0 km";
  const abs = Math.abs(numeric);
  const precision = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${numeric.toFixed(precision)} km`;
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${Math.round(numeric)}%`;
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])
  );
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getPeriodMeta(period) {
  return PERIOD_BY_ID.get(period) || PERIOD_BY_ID.get("year");
}

function getPeriodBounds(period, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  switch (period) {
    case "week": {
      const start = startOfWeek(ref);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    case "month": {
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
      return { start, end };
    }
    default: {
      const start = new Date(ref.getFullYear(), 0, 1);
      const end = new Date(ref.getFullYear() + 1, 0, 1);
      return { start, end };
    }
  }
}

function getPeriodKey(period, referenceDate = new Date()) {
  const { start } = getPeriodBounds(period, referenceDate);
  const iso = start.toISOString().split("T")[0];
  return `${period}-${iso}`;
}

function rangeCoversPeriod(rangeStart, rangeEnd, bounds) {
  if (!(rangeStart instanceof Date) || !(rangeEnd instanceof Date)) return false;
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) return false;
  const startOk = rangeStart <= bounds.start;
  const endOk = endOfDay(rangeEnd).getTime() >= bounds.end.getTime() - 1;
  return startOk && endOk;
}

function computeGoalProgress(activities, goal, bounds) {
  if (!goal || !bounds) return { totalKm: 0, percent: 0 };
  let totalMeters = 0;
  const startTime = bounds.start.getTime();
  const endTime = bounds.end.getTime();

  for (const activity of activities || []) {
    const sport = normalizeSport(activity?.type);
    if (sport !== goal.sportId) continue;

    const dateValue = activity?.date;
    const activityTime =
      typeof dateValue === "number"
        ? dateValue
        : dateValue instanceof Date
        ? dateValue.getTime()
        : Date.parse(dateValue);

    if (Number.isNaN(activityTime)) continue;
    if (activityTime < startTime || activityTime >= endTime) continue;

    totalMeters += Number(activity?.distance) || 0;
  }

  const totalKm = totalMeters / 1000;
  const percent = goal.targetKm > 0 ? (totalKm / goal.targetKm) * 100 : 0;
  return { totalKm, percent };
}

function renderEmptyGoals() {
  if (!goalEls?.carousel) return;
  goalEls.carousel.innerHTML = `
    <div class="goal-slide goal-slide-empty">
      Add a goal to track progress.
    </div>
  `;
  if (goalEls.card) {
    goalEls.card.classList.add("goal-card-empty");
  }
  if (goalEls.note) {
    goalEls.note.hidden = true;
  }
  if (goalEls.prev) {
    goalEls.prev.hidden = true;
  }
  if (goalEls.next) {
    goalEls.next.hidden = true;
  }
  if (goalEls.toggle) {
    goalEls.toggle.setAttribute("aria-label", "Set goal");
  }
  updateHeaderActions();
  updateGoalMetaLabel(null);
  updateNavState();
}

function updateGoalMetaLabel(activePeriod) {
  if (!goalEls?.meta) return;
  if (!activePeriod) {
    goalEls.meta.textContent = "Current period";
    return;
  }
  const meta = getPeriodMeta(activePeriod)?.meta || "Current period";
  goalEls.meta.textContent = meta;
}

function buildGoalNote(progress, goal, meta, isPartial) {
  const parts = [
    `Goal: ${formatKmValue(goal.targetKm, { allowZero: true })}`,
    `${formatPercent(progress.percent)} complete`,
  ];
  if (isPartial) {
    parts.push("Range only");
  }
  return parts.join(" / ");
}

function renderGoals(progressById, partialById = {}) {
  if (!goalEls?.carousel) return;
  if (!goals.length) {
    renderEmptyGoals();
    return;
  }

  const slides = goals
    .map((goal) => {
      const meta = getPeriodMeta(goal.period);
      const sportMeta = getSportMeta(goal.sportId);
      const headingLabel = `${sportMeta?.label || goal.sportId} / ${meta?.label || "Yearly"}`;
      const progress = progressById[goal.id] || { totalKm: 0, percent: 0 };
      const isPartial = Boolean(partialById[goal.id]);
      const note = buildGoalNote(progress, goal, meta, isPartial);
      const fillWidth = Math.min(progress.percent || 0, 100);
      return `
        <div class="goal-slide" data-goal-id="${escapeHtml(goal.id)}" data-goal-period="${escapeHtml(goal.period)}">
          <div class="goal-slide-top">
            <div class="goal-heading" aria-label="${escapeHtml(headingLabel)}" title="${escapeHtml(headingLabel)}">
              <span class="goal-icon"><i class="fa-solid ${escapeHtml(sportMeta?.icon || "fa-flag-checkered")}" aria-hidden="true"></i></span>
              <span class="goal-heading-label">${escapeHtml(headingLabel)}</span>
            </div>
          </div>
          <p class="analysis-value">${formatKmValue(progress.totalKm, { allowZero: true })}</p>
          <div class="progress-track" aria-hidden="true">
            <div class="progress-fill" style="width: ${fillWidth}%"></div>
          </div>
          <p class="goal-sub">${escapeHtml(note)}</p>
        </div>
      `;
    })
    .join("");

  goalEls.carousel.innerHTML = slides;
  if (goalEls.card) {
    goalEls.card.classList.remove("goal-card-empty");
  }

  if (goalEls.note) {
    goalEls.note.hidden = true;
  }
  if (goalEls.prev) {
    goalEls.prev.hidden = false;
  }
  if (goalEls.next) {
    goalEls.next.hidden = false;
  }
  if (goalEls.toggle) {
    goalEls.toggle.setAttribute(
      "aria-label",
      goals.length ? "Add goal" : "Set goal"
    );
  }
  updateHeaderActions();
  updateNavState();
}

function getClosestSlideIndex() {
  if (!goalEls?.carousel) return 0;
  const slides = Array.from(goalEls.carousel.querySelectorAll(".goal-slide"));
  if (!slides.length) return 0;
  const scrollLeft = goalEls.carousel.scrollLeft;
  let closest = 0;
  let closestDistance = Infinity;
  slides.forEach((slide, index) => {
    const distance = Math.abs(slide.offsetLeft - scrollLeft);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = index;
    }
  });
  return closest;
}

function getActiveGoalId() {
  if (!goalEls?.carousel) return null;
  const slides = Array.from(goalEls.carousel.querySelectorAll(".goal-slide"));
  if (!slides.length) return null;
  const index = getClosestSlideIndex();
  return slides[index]?.dataset?.goalId || null;
}

function getActiveGoal() {
  const goalId = getActiveGoalId();
  if (!goalId) return null;
  return goals.find((goal) => goal.id === goalId) || null;
}

function updateHeaderActions() {
  if (!goalEls?.editActive) return;
  const hasGoals = goals.length > 0;
  goalEls.editActive.disabled = !hasGoals;
  goalEls.editActive.setAttribute(
    "aria-label",
    hasGoals ? "Edit goal" : "Edit goal (disabled)"
  );
  if (goalEls.deleteActive) {
    goalEls.deleteActive.disabled = !hasGoals;
    goalEls.deleteActive.setAttribute(
      "aria-label",
      hasGoals ? "Delete goal" : "Delete goal (disabled)"
    );
  }
}

function scrollToSlide(index) {
  if (!goalEls?.carousel) return;
  const slides = Array.from(goalEls.carousel.querySelectorAll(".goal-slide"));
  if (!slides.length) return;
  const clamped = Math.max(0, Math.min(index, slides.length - 1));
  goalEls.carousel.scrollTo({
    left: slides[clamped].offsetLeft,
    behavior: "smooth",
  });
}

function updateNavState() {
  if (!goalEls?.carousel) return;
  const slides = goalEls.carousel.querySelectorAll(".goal-slide");
  const maxScroll = goalEls.carousel.scrollWidth - goalEls.carousel.clientWidth;
  const atStart = goalEls.carousel.scrollLeft <= 2;
  const atEnd = goalEls.carousel.scrollLeft >= maxScroll - 2;

  if (goalEls.prev) {
    goalEls.prev.disabled = slides.length <= 1 || atStart;
  }
  if (goalEls.next) {
    goalEls.next.disabled = slides.length <= 1 || atEnd;
  }

  const index = getClosestSlideIndex();
  const activeSlide = slides[index];
  const activePeriod = activeSlide?.dataset?.goalPeriod;
  updateGoalMetaLabel(activePeriod);
  updateHeaderActions();
}

function handleCarouselScroll() {
  if (scrollRaf) return;
  scrollRaf = window.requestAnimationFrame(() => {
    scrollRaf = null;
    updateNavState();
  });
}

function openGoalModal(goal = null) {
  if (!goalEls?.modal) return;
  currentEditId = goal?.id || null;
  setGoalFormValues(goal);
  if (goalEls.clear) {
    goalEls.clear.hidden = !currentEditId;
  }
  if (goalEls.title) {
    goalEls.title.textContent = currentEditId ? "Edit goal" : "Set goal";
  }
  setFormStatus("");
  goalEls.modal.hidden = false;
  document.body.style.overflow = "hidden";
  window.setTimeout(() => goalEls.sport?.focus(), 0);
}

function closeGoalModal() {
  if (!goalEls?.modal) return;
  goalEls.modal.hidden = true;
  document.body.style.overflow = "";
  currentEditId = null;
  setFormStatus("");
}

function upsertGoal(nextGoal) {
  const existingIndex = goals.findIndex((goal) => goal.id === nextGoal.id);
  if (existingIndex >= 0) {
    goals = goals.map((goal, idx) => (idx === existingIndex ? nextGoal : goal));
    return;
  }

  const duplicateIndex = goals.findIndex(
    (goal) => goal.sportId === nextGoal.sportId && goal.period === nextGoal.period
  );
  if (duplicateIndex >= 0) {
    const duplicate = goals[duplicateIndex];
    goals = goals.map((goal, idx) =>
      idx === duplicateIndex ? { ...nextGoal, id: duplicate.id } : goal
    );
    return;
  }

  goals = [...goals, nextGoal];
}

function removeGoalById(goalId) {
  goals = goals.filter((goal) => goal.id !== goalId);
  saveGoals(goals);
}

function handleGoalSubmit(event) {
  event.preventDefault();
  if (!goalEls?.sport || !goalEls?.target || !goalEls?.period) return;

  const sportId = goalEls.sport.value;
  const targetKm = Number(goalEls.target.value);
  const period = goalEls.period.value;

  if (!SPORT_BY_ID.has(sportId.toLowerCase())) {
    setFormStatus("Pick a valid sport.", "error");
    return;
  }
  if (!Number.isFinite(targetKm)) {
    setFormStatus("Enter a valid distance.", "error");
    return;
  }
  if (targetKm < GOAL_DISTANCE_LIMITS.min || targetKm > GOAL_DISTANCE_LIMITS.max) {
    setFormStatus(
      `Distance must be between ${GOAL_DISTANCE_LIMITS.min} and ${GOAL_DISTANCE_LIMITS.max} km.`,
      "error"
    );
    return;
  }
  if (!PERIOD_BY_ID.has(period)) {
    setFormStatus("Pick a valid period.", "error");
    return;
  }

  const nextGoal = {
    id: currentEditId || `goal_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    sportId: SPORT_BY_ID.get(sportId.toLowerCase()).id,
    targetKm,
    period,
    createdAt: Date.now(),
  };

  upsertGoal(nextGoal);
  saveGoals(goals);
  closeGoalModal();
  updateGoalCard({
    activities: lastActivities,
    rangeStart: lastRangeStart,
    rangeEnd: lastRangeEnd,
  }).catch(() => null);
}

function handleGoalClear() {
  if (!currentEditId) {
    closeGoalModal();
    return;
  }
  removeGoalById(currentEditId);
  closeGoalModal();
  updateGoalCard({
    activities: lastActivities,
    rangeStart: lastRangeStart,
    rangeEnd: lastRangeEnd,
  }).catch(() => null);
}

function handleGoalToggle() {
  openGoalModal(null);
}

function handleModalKey(event) {
  if (event.key === "Escape" && !goalEls?.modal?.hidden) {
    closeGoalModal();
  }
}

function bindGoalEvents() {
  if (!goalEls) return;

  goalEls.form?.addEventListener("submit", handleGoalSubmit);
  goalEls.toggle?.addEventListener("click", handleGoalToggle);
  goalEls.editActive?.addEventListener("click", () => {
    const goal = getActiveGoal();
    if (goal) {
      openGoalModal(goal);
    }
  });
  goalEls.deleteActive?.addEventListener("click", () => {
    const goal = getActiveGoal();
    if (!goal) return;
    removeGoalById(goal.id);
    updateGoalCard({
      activities: lastActivities,
      rangeStart: lastRangeStart,
      rangeEnd: lastRangeEnd,
    }).catch(() => null);
  });
  goalEls.cancel?.addEventListener("click", closeGoalModal);
  goalEls.clear?.addEventListener("click", handleGoalClear);
  goalEls.close?.addEventListener("click", closeGoalModal);
  goalEls.backdrop?.addEventListener("click", closeGoalModal);
  window.addEventListener("keydown", handleModalKey);

  goalEls.carousel?.addEventListener("scroll", handleCarouselScroll);
  goalEls.prev?.addEventListener("click", () => {
    const index = getClosestSlideIndex();
    scrollToSlide(index - 1);
  });
  goalEls.next?.addEventListener("click", () => {
    const index = getClosestSlideIndex();
    scrollToSlide(index + 1);
  });
}

async function fetchPeriodActivities(bounds) {
  const params = new URLSearchParams({
    after: bounds.start.toISOString(),
    before: bounds.end.toISOString(),
  });
  return api(`/api/activities?${params.toString()}`);
}

async function ensurePeriodActivities(period, bounds) {
  const key = getPeriodKey(period);
  if (periodCache.has(key)) return periodCache.get(key);
  if (pendingPeriod.has(key)) return pendingPeriod.get(key);

  const promise = fetchPeriodActivities(bounds)
    .then((data) => {
      if (Array.isArray(data)) {
        periodCache.set(key, data);
        return data;
      }
      return null;
    })
    .catch((err) => {
      console.warn("Goal period load failed:", err);
      return null;
    })
    .finally(() => pendingPeriod.delete(key));

  pendingPeriod.set(key, promise);
  return promise;
}

export function initGoalCard() {
  goalEls = getGoalElements();
  if (!goalEls) return;
  ensureGoalLoaded();

  populateSportOptions(goalEls.sport);
  setGoalFormValues(null);
  bindGoalEvents();

  updateGoalCard({
    activities: lastActivities,
    rangeStart: lastRangeStart,
    rangeEnd: lastRangeEnd,
  }).catch(() => null);

  syncGoalsFromServer().catch(() => null);
}

export async function updateGoalCard({ activities = [], rangeStart, rangeEnd } = {}) {
  ensureGoalLoaded();
  goalEls = getGoalElements();
  if (!goalEls) return;

  lastActivities = Array.isArray(activities) ? activities : [];
  lastRangeStart = rangeStart instanceof Date ? rangeStart : null;
  lastRangeEnd = rangeEnd instanceof Date ? rangeEnd : null;

  if (!goals.length) {
    renderEmptyGoals();
    return;
  }

  const progressById = {};
  const partialById = {};
  const periodsNeedingFetch = new Map();
  const periodSources = new Map();

  goals.forEach((goal) => {
    const period = goal.period;
    if (periodSources.has(period)) return;
    const bounds = getPeriodBounds(period);
    const cacheKey = getPeriodKey(period);
    const cacheData = periodCache.get(cacheKey);
    const covers = rangeCoversPeriod(lastRangeStart, lastRangeEnd, bounds);

    if (covers && lastActivities.length) {
      periodCache.set(cacheKey, lastActivities);
      periodSources.set(period, { activities: lastActivities, bounds, partial: false });
      return;
    }

    if (cacheData) {
      periodSources.set(period, { activities: cacheData, bounds, partial: false });
      return;
    }

    if (lastActivities.length) {
      periodSources.set(period, { activities: lastActivities, bounds, partial: true });
      periodsNeedingFetch.set(period, bounds);
      return;
    }

    periodSources.set(period, { activities: [], bounds, partial: true });
    periodsNeedingFetch.set(period, bounds);
  });

  goals.forEach((goal) => {
    const source = periodSources.get(goal.period);
    const progress = computeGoalProgress(source?.activities, goal, source?.bounds);
    progressById[goal.id] = progress;
    partialById[goal.id] = source?.partial;
  });

  renderGoals(progressById, partialById);

  if (periodsNeedingFetch.size) {
    await Promise.all(
      Array.from(periodsNeedingFetch.entries()).map(([period, bounds]) =>
        ensurePeriodActivities(period, bounds)
      )
    );

    goals.forEach((goal) => {
      const bounds = getPeriodBounds(goal.period);
      const cacheKey = getPeriodKey(goal.period);
      const cacheData = periodCache.get(cacheKey);
      if (!cacheData) return;
      progressById[goal.id] = computeGoalProgress(cacheData, goal, bounds);
      partialById[goal.id] = false;
    });

    renderGoals(progressById, partialById);
  }
}
