import { els } from "./dom.js";
import { state } from "./state.js";

const DEFAULT_MAX_HEART_RATE = 190;
const DEFAULT_RESTING_HEART_RATE = 60;
const CTL_WINDOW_DAYS = 42;
const ATL_WINDOW_DAYS = 7;
const DEBUG_STORAGE_KEY = "atlo.debugTrainingLoad";

function formatSufferRatio(value, hasData = true) {
  if (!hasData) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  if (numeric > 0 && numeric < 0.01) return "<0.01";
  return numeric.toFixed(2);
}

function getLoadStatus(ratio, hasData) {
  if (!hasData) return { label: "—", tone: "neutral" };
  const numeric = Number(ratio);
  if (!Number.isFinite(numeric)) return { label: "—", tone: "neutral" };
  if (numeric < 0.8) return { label: "Low", tone: "low" };
  if (numeric <= 1.3) return { label: "Balanced", tone: "balanced" };
  return { label: "High", tone: "high" };
}

function getTrainingLoadReferenceTime() {
  return Date.now();
}

function getMaxHeartRateValue() {
  const numeric = Number(state.maxHeartRate);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  return DEFAULT_MAX_HEART_RATE;
}

function getRestingHeartRateValue() {
  const numeric = Number(state.restingHeartRate);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  return DEFAULT_RESTING_HEART_RATE;
}

function formatRestingHeartRate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "RHR —";
  return `RHR ${Math.round(numeric)} bpm`;
}

function updateProfileSummary() {
  const restingEl = document.querySelector('[data-metric="resting-hr"]');
  if (!restingEl) return;
  restingEl.textContent = formatRestingHeartRate(state.restingHeartRate);
}

function shouldDebugTrainingLoad() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debugLoad") === "1") return true;
  } catch {
    // ignore
  }

  try {
    return window.localStorage?.getItem(DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export async function ensureMaxHeartRate() {
  const hasMax =
    Number.isFinite(Number(state.maxHeartRate)) && state.maxHeartRate > 0;
  const hasResting =
    Number.isFinite(Number(state.restingHeartRate)) &&
    state.restingHeartRate > 0;

  if (hasMax && hasResting) {
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
    }
    const restingHeartRate = Number(data?.restingHeartRate);
    if (Number.isFinite(restingHeartRate) && restingHeartRate > 0 && restingHeartRate < state.maxHeartRate) {
      state.restingHeartRate = restingHeartRate;
    } else {
      state.restingHeartRate = null;
    }
    updateProfileSummary();
    return Number.isFinite(state.maxHeartRate) ? state.maxHeartRate : null;
  } catch (err) {
    console.warn("Profile load failed:", err);
  }

  return null;
}

function buildSufferSparkline(
  activities = [],
  scores = [],
  maxBars = 28,
  referenceTime = Date.now(),
  maxValueOverride = null
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
    pairs.push({ value: score, isRecent, activityId: activity?.id });
  }

  const values = pairs.reverse();
  const localMax = values.length
    ? values.reduce((max, item) => Math.max(max, item.value), 0)
    : 0;
  const maxValue =
    Number.isFinite(maxValueOverride) && maxValueOverride > 0
      ? maxValueOverride
      : localMax;

  return values.map((item) => {
    const height = maxValue
      ? Math.max((item.value / maxValue) * 100, item.value ? 6 : 0)
      : 0;
    return {
      height: Math.min(height, 100),
      isRecent: item.isRecent,
      activityId: item.activityId,
    };
  });
}

function updateAnalysisDisplay() {
  const trainingLoadEl = document.querySelector(
    '[data-metric="training-load"]'
  );
  const loadShortEl = document.querySelector('[data-metric="load-short"]');
  const loadStatusEl = document.querySelector(
    '[data-metric="training-load-status"]'
  );
  updateProfileSummary();
  const sparklineEl = document.querySelector(".analysis-sparkline");

  const atl = Number(state.trainingLoad?.atl) || 0;
  const ctl = Number(state.trainingLoad?.ctl) || 0;
  const hasRatioData = ctl > 0;
  const ratio = hasRatioData ? atl / ctl : NaN;

  if (trainingLoadEl) {
    trainingLoadEl.textContent = formatSufferRatio(ratio, hasRatioData);
  }

  if (loadShortEl) {
    loadShortEl.textContent = formatSufferRatio(ratio, hasRatioData);
  }

  if (loadStatusEl) {
    const status = getLoadStatus(ratio, hasRatioData);
    loadStatusEl.textContent = status.label;
    loadStatusEl.classList.remove("is-low", "is-balanced", "is-high");
    if (status.tone === "low") loadStatusEl.classList.add("is-low");
    if (status.tone === "balanced") loadStatusEl.classList.add("is-balanced");
    if (status.tone === "high") loadStatusEl.classList.add("is-high");
  }

  if (!sparklineEl) return;

  const bars = buildSufferSparkline(
    state.last28DaysActivities,
    state.last28DaysSufferScore,
    28,
    getTrainingLoadReferenceTime(),
    state.maxSufferScore
  );
  sparklineEl.style.setProperty(
    "--bar-count",
    Math.max(1, bars.length).toString()
  );
  const helpLink =
    '<a class="analysis-help" href="/api/pages?slug=analysis" target="_blank" rel="noopener noreferrer" aria-label="Training load notes">?</a>';
  sparklineEl.innerHTML =
    bars
      .map((bar) => {
        const classes = `analysis-sparkline-bar${
          bar.isRecent ? " is-recent" : ""
        }`;
        if (!bar.activityId) {
          return `<span class="${classes}" style="--h: ${bar.height}%"></span>`;
        }
        return `<a class="${classes}" style="--h: ${bar.height}%"
          href="https://www.strava.com/activities/${bar.activityId}"
          target="_blank" rel="noopener noreferrer"
          aria-label="Open Strava activity ${bar.activityId}"></a>`;
      })
      .join("") + helpLink;
}

function computeTrimp(movingTimeSeconds, averageHeartrate, maxHeartRate) {
  const durationMinutes = Number(movingTimeSeconds) / 60;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  if (!Number.isFinite(averageHeartrate) || averageHeartrate <= 0) return 0;
  if (!Number.isFinite(maxHeartRate) || maxHeartRate <= 0) return 0;
  const restingHeartRate = getRestingHeartRateValue();
  if (maxHeartRate <= restingHeartRate) return 0;

  const hrRatioRaw =
    (averageHeartrate - restingHeartRate) /
    (maxHeartRate - restingHeartRate);
  const hrRatio = Math.min(Math.max(hrRatioRaw, 0), 1.2);
  const b = 1.92;
  return durationMinutes * hrRatio * Math.exp(b * hrRatio);
}

export function computeActivityLoad(activity, maxHeartRateOverride) {
  const movingTime =
    Number(activity?.moving_time ?? activity?.movingTime) || 0;
  const averageHeartrate = Number(activity?.average_heartrate) || 0;
  const override = Number(maxHeartRateOverride);
  const resolvedMax =
    Number.isFinite(override) && override > 0
      ? override
      : getMaxHeartRateValue();
  return computeTrimp(movingTime, averageHeartrate, resolvedMax);
}

function computeAtlCtl(dailyLoads, referenceTime) {
  const end = new Date(referenceTime);
  if (Number.isNaN(end.getTime())) {
    return { atl: 0, ctl: 0 };
  }

  const endUtc = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );

  const dayKeys = Object.keys(dailyLoads);
  const earliestKey = dayKeys.sort()[0];
  const defaultStart = new Date(endUtc);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 90);

  let startUtc = defaultStart;
  if (earliestKey) {
    const parsed = new Date(`${earliestKey}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed < startUtc) {
      startUtc = parsed;
    }
  }

  let ctl = 0;
  let atl = 0;
  for (
    let cursor = new Date(startUtc);
    cursor <= endUtc;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const key = cursor.toISOString().slice(0, 10);
    const load = Number(dailyLoads[key]) || 0;
    ctl += (load - ctl) / CTL_WINDOW_DAYS;
    atl += (load - atl) / ATL_WINDOW_DAYS;
  }

  return { atl, ctl };
}

export function updateTrainingLoadFromActivities(activities = []) {
  const now = getTrainingLoadReferenceTime();
  const cutoff7Days = now - 7 * 24 * 60 * 60 * 1000;
  const cutoff28Days = now - 28 * 24 * 60 * 60 * 1000;
  const cutoffCtl = now - 90 * 24 * 60 * 60 * 1000;
  const last7DaysActivities = [];
  const last28DaysActivities = [];
  const last7DaysSufferScore = [];
  const last28DaysSufferScore = [];
  let maxSufferScore = 0;
  const maxHeartRate = getMaxHeartRateValue();
  const dailyLoads = {};
  const debugEnabled = shouldDebugTrainingLoad();
  const debug = debugEnabled
    ? {
        referenceTime: new Date(now).toISOString(),
        maxHeartRate,
        restingHeartRate: RESTING_HEART_RATE,
        windowDays: { atl: ATL_WINDOW_DAYS, ctl: CTL_WINDOW_DAYS },
        cutoffs: {
          last7: new Date(cutoff7Days).toISOString(),
          last28: new Date(cutoff28Days).toISOString(),
          ctlLookback: new Date(cutoffCtl).toISOString(),
        },
        activitiesTotal: activities.length,
        activitiesMissingHr: 0,
        activitiesMissingMovingTime: 0,
        hrSamples: 0,
        hrSum: 0,
        hrMin: null,
        hrMax: null,
        movingTimeSamples: 0,
        movingTimeSum: 0,
        movingTimeMin: null,
        movingTimeMax: null,
        hrRatioMin: null,
        hrRatioMax: null,
        trimpSamples: 0,
        trimpSum: 0,
        trimpMin: null,
        trimpMax: null,
        last7TrimpSum: 0,
        last28TrimpSum: 0,
        earliestActivity: null,
        latestActivity: null,
        sortedDesc: true,
      }
    : null;

  let previousTime = null;

  for (const activity of activities) {
    const dateValue = activity?.date;
    const activityTime =
      typeof dateValue === "number"
        ? dateValue
        : dateValue instanceof Date
        ? dateValue.getTime()
        : Date.parse(dateValue);

    if (Number.isNaN(activityTime)) continue;
    if (debug) {
      if (previousTime !== null && activityTime > previousTime) {
        debug.sortedDesc = false;
      }
      previousTime = activityTime;
      debug.earliestActivity =
        debug.earliestActivity === null
          ? activityTime
          : Math.min(debug.earliestActivity, activityTime);
      debug.latestActivity =
        debug.latestActivity === null
          ? activityTime
          : Math.max(debug.latestActivity, activityTime);
    }

    const movingTime = Number(activity?.moving_time) || 0;
    const averageHeartrate = Number(activity?.average_heartrate) || 0;
    const trimpScore = computeTrimp(
      movingTime,
      averageHeartrate,
      maxHeartRate
    );
    if (trimpScore > maxSufferScore) {
      maxSufferScore = trimpScore;
    }

    if (debug) {
      if (averageHeartrate <= 0) {
        debug.activitiesMissingHr += 1;
      } else {
        debug.hrSamples += 1;
        debug.hrSum += averageHeartrate;
        debug.hrMin =
          debug.hrMin === null
            ? averageHeartrate
            : Math.min(debug.hrMin, averageHeartrate);
        debug.hrMax =
          debug.hrMax === null
            ? averageHeartrate
            : Math.max(debug.hrMax, averageHeartrate);
      }

      if (movingTime <= 0) {
        debug.activitiesMissingMovingTime += 1;
      } else {
        debug.movingTimeSamples += 1;
        debug.movingTimeSum += movingTime;
        debug.movingTimeMin =
          debug.movingTimeMin === null
            ? movingTime
            : Math.min(debug.movingTimeMin, movingTime);
        debug.movingTimeMax =
          debug.movingTimeMax === null
            ? movingTime
            : Math.max(debug.movingTimeMax, movingTime);
      }

      if (maxHeartRate > RESTING_HEART_RATE && averageHeartrate > 0) {
        const hrRatioRaw =
          (averageHeartrate - RESTING_HEART_RATE) /
          (maxHeartRate - RESTING_HEART_RATE);
        const hrRatio = Math.min(Math.max(hrRatioRaw, 0), 1.2);
        debug.hrRatioMin =
          debug.hrRatioMin === null ? hrRatio : Math.min(debug.hrRatioMin, hrRatio);
        debug.hrRatioMax =
          debug.hrRatioMax === null ? hrRatio : Math.max(debug.hrRatioMax, hrRatio);
      }

      if (trimpScore > 0) {
        debug.trimpSamples += 1;
        debug.trimpSum += trimpScore;
        debug.trimpMin =
          debug.trimpMin === null
            ? trimpScore
            : Math.min(debug.trimpMin, trimpScore);
        debug.trimpMax =
          debug.trimpMax === null
            ? trimpScore
            : Math.max(debug.trimpMax, trimpScore);
      }
    }

    if (activityTime >= cutoffCtl) {
      const dayKey = new Date(activityTime).toISOString().slice(0, 10);
      dailyLoads[dayKey] = (dailyLoads[dayKey] || 0) + trimpScore;
    }

    if (activityTime < cutoff28Days) continue;

    last28DaysActivities.push(activity);
    last28DaysSufferScore.push(trimpScore);
    if (debug) {
      debug.last28TrimpSum += trimpScore;
    }

    if (activityTime >= cutoff7Days) {
      last7DaysActivities.push(activity);
      last7DaysSufferScore.push(trimpScore);
      if (debug) {
        debug.last7TrimpSum += trimpScore;
      }
    }
  }

  state.last7DaysActivities = last7DaysActivities;
  state.last28DaysActivities = last28DaysActivities;
  state.last7DaysSufferScore = last7DaysSufferScore;
  state.last28DaysSufferScore = last28DaysSufferScore;
  state.maxSufferScore = maxSufferScore;

  const { atl, ctl } = computeAtlCtl(dailyLoads, now);
  state.trainingLoad = {
    atl,
    ctl,
    ratio: ctl > 0 ? atl / ctl : null,
  };

  if (debug) {
    const dailyLoadValues = Object.values(dailyLoads).map((v) => Number(v) || 0);
    const dailyLoadSum = dailyLoadValues.reduce((sum, v) => sum + v, 0);
    debug.dailyLoadDays = dailyLoadValues.length;
    debug.dailyLoadSum = dailyLoadSum;
    debug.last7Count = last7DaysActivities.length;
    debug.last28Count = last28DaysActivities.length;
    debug.atl = atl;
    debug.ctl = ctl;
    debug.ratio = ctl > 0 ? atl / ctl : null;
    debug.hrMean = debug.hrSamples ? debug.hrSum / debug.hrSamples : null;
    debug.movingTimeMean =
      debug.movingTimeSamples ? debug.movingTimeSum / debug.movingTimeSamples : null;
    debug.trimpMean =
      debug.trimpSamples ? debug.trimpSum / debug.trimpSamples : null;
    debug.earliestActivity = debug.earliestActivity
      ? new Date(debug.earliestActivity).toISOString()
      : null;
    debug.latestActivity = debug.latestActivity
      ? new Date(debug.latestActivity).toISOString()
      : null;

    try {
      window.__atloTrainingLoadDebug = debug;
      console.groupCollapsed("Atlo training load debug");
      console.log(debug);
      console.groupEnd();
    } catch {
      // ignore
    }
  }
  updateAnalysisDisplay();
}
