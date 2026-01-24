import { els } from "./dom.js";
import { state } from "./state.js";

const DEFAULT_MAX_HEART_RATE = 190;

function formatSufferRatio(value, hasData = true) {
  if (!hasData) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  if (numeric > 0 && numeric < 0.01) return "<0.01";
  return numeric.toFixed(2);
}

function getTrainingLoadReferenceTime() {
  const endValue = els.endDate?.value;
  if (endValue) {
    const endDate = new Date(endValue);
    if (!Number.isNaN(endDate.getTime())) {
      return endDate.getTime();
    }
  }
  return Date.now();
}

function getMaxHeartRateValue() {
  const numeric = Number(state.maxHeartRate);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  return DEFAULT_MAX_HEART_RATE;
}

export async function ensureMaxHeartRate() {
  if (Number.isFinite(Number(state.maxHeartRate)) && state.maxHeartRate > 0) {
    return state.maxHeartRate;
  }

  try {
    const res = await fetch("/api/profile", { credentials: "include" });
    if (!res.ok) {
      return null;
    }
    const data = await res.json().catch(() => ({}));
    const maxHeartRate = Number(data?.maxHeartRate);
    if (Number.isFinite(maxHeartRate) && maxHeartRate > 0) {
      state.maxHeartRate = maxHeartRate;
      return maxHeartRate;
    }
  } catch (err) {
    console.warn("Profile load failed:", err);
  }

  return null;
}

function buildSufferSparkline(
  activities = [],
  scores = [],
  maxBars = 28,
  referenceTime = Date.now()
) {
  const cutoff7Days = referenceTime - 7 * 24 * 60 * 60 * 1000;
  const count = Math.min(activities.length, scores.length, maxBars);
  const pairs = [];

  for (let i = 0; i < count; i += 1) {
    const activity = activities[i];
    const score = Number(scores[i]) || 0;
    const dateValue = activity?.date;
    const activityTime =
      typeof dateValue === "number"
        ? dateValue
        : dateValue instanceof Date
        ? dateValue.getTime()
        : Date.parse(dateValue);
    const isRecent = !Number.isNaN(activityTime) && activityTime >= cutoff7Days;
    pairs.push({ value: score, isRecent });
  }

  const values = pairs.reverse();
  const maxValue = values.length
    ? values.reduce((max, item) => Math.max(max, item.value), 0)
    : 0;

  return values.map((item) => {
    const height = maxValue
      ? Math.max((item.value / maxValue) * 100, item.value ? 6 : 0)
      : 0;
    return {
      height: Math.min(height, 100),
      isRecent: item.isRecent,
    };
  });
}

function updateAnalysisDisplay() {
  const trainingLoadEl = document.querySelector(
    '[data-metric="training-load"]'
  );
  const loadShortEl = document.querySelector('[data-metric="load-short"]');
  const sparklineEl = document.querySelector(".analysis-sparkline");

  const last7Total = (state.last7DaysSufferScore || []).reduce(
    (sum, score) => sum + (Number(score) || 0),
    0
  );
  const last28Total = (state.last28DaysSufferScore || []).reduce(
    (sum, score) => sum + (Number(score) || 0),
    0
  );
  const hasLast7Activities = (state.last7DaysActivities?.length || 0) > 0;
  const hasRatioData = last28Total > 0 && hasLast7Activities && last7Total > 0;
  const ratio = hasRatioData ? last7Total / last28Total : NaN;

  if (trainingLoadEl) {
    trainingLoadEl.textContent = formatSufferRatio(ratio, hasRatioData);
  }

  if (loadShortEl) {
    loadShortEl.textContent = formatSufferRatio(ratio, hasRatioData);
  }

  if (!sparklineEl) return;

  const bars = buildSufferSparkline(
    state.last28DaysActivities,
    state.last28DaysSufferScore,
    28,
    getTrainingLoadReferenceTime()
  );
  sparklineEl.style.setProperty(
    "--bar-count",
    Math.max(1, bars.length).toString()
  );
  const helpLink =
    '<a class="analysis-help" href="/api/pages?slug=analysis" target="_blank" rel="noopener noreferrer" aria-label="Training load notes">?</a>';
  sparklineEl.innerHTML =
    bars
      .map(
        (bar) =>
          `<span style="--h: ${bar.height}%"${
            bar.isRecent ? ' class="is-recent"' : ""
          }></span>`
      )
      .join("") + helpLink;
}

export function updateTrainingLoadFromActivities(activities = []) {
  const now = getTrainingLoadReferenceTime();
  const cutoff7Days = now - 7 * 24 * 60 * 60 * 1000;
  const cutoff28Days = now - 28 * 24 * 60 * 60 * 1000;
  const last7DaysActivities = [];
  const last28DaysActivities = [];
  const last7DaysSufferScore = [];
  const last28DaysSufferScore = [];
  const maxHeartRate = getMaxHeartRateValue();

  for (const activity of activities) {
    const dateValue = activity?.date;
    const activityTime =
      typeof dateValue === "number"
        ? dateValue
        : dateValue instanceof Date
        ? dateValue.getTime()
        : Date.parse(dateValue);

    if (Number.isNaN(activityTime)) continue;
    if (activityTime < cutoff28Days) break;

    last28DaysActivities.push(activity);
    const movingTime = Number(activity?.moving_time) || 0;
    const averageHeartrate = Number(activity?.average_heartrate) || 0;
    const sufferScore =
      (movingTime / 60.0) * (averageHeartrate / maxHeartRate);
    last28DaysSufferScore.push(sufferScore);

    if (activityTime >= cutoff7Days) {
      last7DaysActivities.push(activity);
      last7DaysSufferScore.push(sufferScore);
    }
  }

  state.last7DaysActivities = last7DaysActivities;
  state.last28DaysActivities = last28DaysActivities;
  state.last7DaysSufferScore = last7DaysSufferScore;
  state.last28DaysSufferScore = last28DaysSufferScore;
  updateAnalysisDisplay();
}
