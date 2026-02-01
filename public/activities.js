import { api } from "./api.js";
import {
  renderSummary,
  showStatusSpinner,
  hideStatusSpinner,
  showStatusMessage,
} from "./ui.js";
import { gearSummaryTemplate } from "./templates/gearSummaryTemplate.js";
import { renderPolylines, applyMapStyle } from "./map.js";
import { els } from "./dom.js";
import { state } from "./state.js";
import { getDateRange, formatRangeLabel } from "./dateRange.js";
import { handleAuthRequired, updateAuthUI } from "./auth.js";
import {
  renderCurrentPage,
  updatePaginationControls,
  applyActivityFilter,
  addActivityTypeFilterButtons,
  setActiveActivitySummaryButton,
  bindPaginationControls,
  bindListToggle,
} from "./listView.js";
import { ensureMaxHeartRate, updateTrainingLoadFromActivities } from "./analysis.js";
import { updateGoalCard } from "./goals.js";

const AUTH_ERROR_PATTERN = /(Not authenticated|Missing session state|No token)/i;
const TRAINING_LOAD_LOOKBACK_DAYS = 90;

function computeTotals(activities) {
  return activities.reduce(
    (acc, item) => {
      acc.distance += Number(item.distance) || 0;
      acc.movingTime += Number(item.movingTime) || 0;
      acc.elevationGain += Number(item.elevationGain) || 0;
      return acc;
    },
    { distance: 0, movingTime: 0, elevationGain: 0 }
  );
}

const getCssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
  fallback;

const formatGearLabel = (gear) => {
  const parts = [gear?.brand_name, gear?.model_name]
    .map((p) => (p || "").toString().trim())
    .filter(Boolean);
  return parts.join(" - ") || gear?.id || "Gear";
};

function renderGearChart(items = []) {
  if (!els.list) return;
  const canvas = els.list.querySelector("#gear-chart");
  if (!canvas || !items.length) return;

  if (state.gearChartInstance) {
    state.gearChartInstance.destroy();
    state.gearChartInstance = null;
  }

  if (!window?.Chart) {
    canvas.parentElement.innerHTML = `<p class="muted">Chart unavailable (Chart.js not loaded).</p>`;
    return;
  }

  const labels = items.map((item) => formatGearLabel(item));
  const distances = items.map((item) =>
    Number.isFinite(item?.distance) ? +(item.distance / 1000).toFixed(2) : 0
  );

  const barColor = getCssVar("--accent", "#113c4c");
  const border = getCssVar("--border", "rgba(15,23,42,0.12)");
  const muted = getCssVar("--muted", "#64748b");

  state.gearChartInstance = new window.Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: distances,
          backgroundColor: `${barColor}cc`,
          borderColor: barColor,
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 18,
          maxBarThickness: 18,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.x?.toFixed(1) || 0} km`,
          },
        },
      },
      scales: {
        x: {
          title: { display: false },
          grid: { color: border },
          ticks: {
            color: muted,
            callback: (val) => `${val} km`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: muted },
        },
      },
    },
  });
}

async function fetchGearDetails(gearIds = []) {
  const ids = (gearIds || []).filter(Boolean);
  if (!ids.length) return [];

  const missing = ids.filter((id) => !state.gearCache.has(id));
  if (missing.length) {
    const params = new URLSearchParams();
    missing.forEach((id) => params.append("id", id));
    const fetched = await api(`/api/gears?${params.toString()}`);
    if (Array.isArray(fetched)) {
      fetched.forEach((item) => state.gearCache.set(item.id, item));      
    }
  }

  return ids
    .map((id) => state.gearCache.get(id))
    .filter(Boolean);
}

const viewModes = {
  list: {
    showPagination: true,
    useGlobalSpinner: true,
    prepare: () => ({}),
    render: () => renderCurrentPage(),
  },
  summary: {
    showPagination: false,
    useGlobalSpinner: true,
    prepare: (activities) => ({ totals: computeTotals(activities) }),
    render: ({ context, activities }) =>
      renderSummary(context.totals, activities.length, els.list, activities),
  },
  gears: {
    showPagination: false,
    useGlobalSpinner: false,
    renderLoading: () => {
      if (!els.list) return;
      els.list.innerHTML = gearSummaryTemplate({
        gearsLabel: "Loading gear…",
        items: [],
        loading: true,
      });
    },
    prepare: async () => {
      const gear = await fetchGearDetails(state.displayGearIDs);
      return { gear };
    },
    render: ({ context }) => {
      if (!els.list) return;
      const gearsCount = Array.isArray(context.gear) ? context.gear.length : 0;
      const gearsLabel = `${gearsCount} gear${gearsCount === 1 ? "" : "s"}`;
      els.list.innerHTML = gearSummaryTemplate({ gearsLabel, items: context.gear });
      renderGearChart(context.gear);
    },
  },
};

export async function updateActivityDisplay({ skipMapUpdate = false } = {}) {
  let viewMode = viewModes[state.activeSummaryStyle] || viewModes.list;
  if (viewMode.useGlobalSpinner !== false) {
    showStatusSpinner();
  }

  try {
    if (els.pagination) {
      els.pagination.hidden = !viewMode.showPagination;
      els.pagination.classList.toggle("display-summary", !viewMode.showPagination);
    }

    if (!state.allActivities.length) {
      state.displayActivities = [];
      els.count.textContent = "0";
      state.expandedActivities.clear();
      if (!skipMapUpdate && state.mapInstance) {
        renderPolylines(state.mapInstance, []);
      }
      state.currentPage = 1;
      renderCurrentPage();
      updatePaginationControls();

      return;
    }

    applyActivityFilter(state.currentActivityFilter);
    state.currentPage = 1;

    els.count.textContent = state.displayActivities.length.toString();
    state.expandedActivities.clear();

    if (!skipMapUpdate && state.mapInstance) {
      renderPolylines(state.mapInstance, state.displayActivities);
    }

    if (viewMode.renderLoading) {
      viewMode.renderLoading();
    }

    const context = viewMode.prepare
      ? await viewMode.prepare(state.displayActivities)
      : {};
    await Promise.resolve(
      viewMode.render({ context, activities: state.displayActivities })
    );
  } finally {
    if (viewMode.useGlobalSpinner !== false) {
      hideStatusSpinner();
    }
  }
}

export function setActiveMapStyle(styleId) {
  if (!els.mapStyleButtons?.length) return;
  els.mapStyleButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mapStyle === styleId);
  });
}

export function changeMapStyle(styleId) {
  if (!styleId || styleId === state.activeMapStyle) return;
  state.activeMapStyle = styleId;
  setActiveMapStyle(styleId);
  if (state.mapInstance) {
    applyMapStyle(state.mapInstance, styleId, state.displayActivities);
  }
}

export function changeSummaryStyle(styleId) {
  const next = (styleId || "").toString().toLowerCase();
  if (!next || next === state.activeSummaryStyle) return;

  state.activeSummaryStyle = next;
  setActiveActivitySummaryButton(next);
  return updateActivityDisplay({ skipMapUpdate: true });
}

export async function loadActivities() {
  const { start, end } = getDateRange();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    showStatusMessage("Select a valid timeframe.", "var(--error)");
    return;
  }

  if (start > end) {
    showStatusMessage(
      "The start date has to be before the end date.",
      "var(--error)"
    );
    return;
  }

  const labelTarget =
    els.rangeLabel?.querySelector(".range-label-text") || els.rangeLabel;
  const currentLabel = labelTarget?.textContent?.trim() || "";
  const isAllRange =
    Array.from(els.quickButtons || []).some(
      (btn) => btn.classList.contains("active") && btn.dataset.range === "all"
    ) || currentLabel === "All";
  if (labelTarget) {
    labelTarget.textContent = isAllRange
      ? "All"
      : formatRangeLabel(start, end);
  }
  showStatusSpinner();

  try {
    await ensureMaxHeartRate();
    const before = new Date(els.endDate.value);
    before.setDate(before.getDate() + 1); // include end date activities by offsetting the upper bound
    const beforeParam = Number.isNaN(before.getTime())
      ? els.endDate.value
      : before.toISOString();

    const params = new URLSearchParams({
      after: els.startDate.value,
      before: beforeParam,
    });

    const trainingBefore = new Date();
    const trainingAfter = new Date(trainingBefore);
    trainingAfter.setDate(
      trainingAfter.getDate() - TRAINING_LOAD_LOOKBACK_DAYS
    );
    const trainingParams = new URLSearchParams({
      after: trainingAfter.toISOString(),
      before: trainingBefore.toISOString(),
    });

    const [listResult, trainingResult] = await Promise.allSettled([
      api(`/api/activities?${params.toString()}`),
      api(`/api/activities?${trainingParams.toString()}`),
    ]);

    if (listResult.status !== "fulfilled") {
      throw listResult.reason;
    }

    state.allActivities = listResult.value;
    state.trainingLoadActivities =
      trainingResult.status === "fulfilled"
        ? trainingResult.value
        : listResult.value;

    updateTrainingLoadFromActivities(state.trainingLoadActivities);
    addActivityTypeFilterButtons(state.allActivities, () =>
      updateActivityDisplay().catch((err) =>
        console.error("Failed to update activities:", err)
      )
    );
    await updateActivityDisplay();
    updateGoalCard({ activities: state.allActivities, rangeStart: start, rangeEnd: end }).catch(
      (err) => console.warn("Goal update failed:", err)
    );

    if (state.isAuthenticated) {
      updateAuthUI(true);
    }
  } catch (err) {
    console.error(err);
    if (AUTH_ERROR_PATTERN.test(err?.message || "")) {
      handleAuthRequired("Connect Strava to load your activities.");
    } else {
      showStatusMessage(err.message, "var(--error)");
    }
  } finally {
    hideStatusSpinner();
  }
}

export function bindMapStyleButtons() {
  els.mapStyleButtons.forEach((btn) => {
    btn.addEventListener("click", () => changeMapStyle(btn.dataset.mapStyle));
  });
}

export function bindSummaryStyleButtons() {
  els.summaryStyleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      changeSummaryStyle(btn.getAttribute("activity-summary-style"))?.catch(
        (err) => console.error("Failed to switch summary view:", err)
      );
    });
  });
}

export {
  renderCurrentPage,
  setActiveActivitySummaryButton,
  bindPaginationControls,
  bindListToggle,
};
