import { renderList } from "./ui.js";
import { focusActivity } from "./map.js";
import { els } from "./dom.js";
import { state } from "./state.js";

const PAGE_SIZE = 10;

function getTotalPages() {
  return Math.max(1, Math.ceil(state.displayActivities.length / PAGE_SIZE));
}

export function updatePaginationControls() {
  if (!els.pagination || !els.pageIndicator || !els.prevPage || !els.nextPage) {
    return;
  }
  const totalPages = getTotalPages();
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  els.pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages}`;
  els.prevPage.disabled = state.currentPage === 1;
  els.nextPage.disabled = state.currentPage === totalPages;
  const shouldShow = state.displayActivities.length > 0 && totalPages > 1;
  els.pagination.hidden = !shouldShow;
}

export function renderCurrentPage() {
  if (!els.list) return;
  if (!state.displayActivities.length) {
    state.currentPage = 1;
    renderList([], els.list);
    if (els.pagination) {
      els.pagination.hidden = true;
    }
    updatePaginationControls();
    return;
  }

  const totalPages = getTotalPages();
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }
  const start = (state.currentPage - 1) * PAGE_SIZE;
  const pageItems = state.displayActivities.slice(start, start + PAGE_SIZE);
  renderList(pageItems, els.list, state.expandedActivities);
  updatePaginationControls();
}

function collectGearIds(activities = []) {
  return [...new Set(activities.map((item) => item.gear_id).filter(Boolean))];
}

export function applyActivityFilter(filter) {
  const normalizedFilter = (filter || "All").toString().trim() || "All";
  state.currentActivityFilter = normalizedFilter;

  if (!state.allActivities.length) {
    state.displayActivities = [];
    state.displayGearIDs = [];
    return;
  }

  if (normalizedFilter === "All") {
    state.displayActivities = [...state.allActivities];
    state.displayGearIDs = collectGearIds(state.displayActivities);
    return;
  }

  state.displayActivities = state.allActivities.filter(
    (activity) => activity.type === normalizedFilter
  );
  state.displayGearIDs = collectGearIds(state.displayActivities);
}

function setActiveActivityFilterButton(filterLabel = "All") {
  if (!els.activityFilterButtons) return;
  Array.from(els.activityFilterButtons.querySelectorAll("button")).forEach(
    (btn) => {
      const label = (btn.dataset.filter || btn.textContent || "").trim();
      btn.classList.toggle("active", label === filterLabel);
    }
  );
}

export function setActiveActivitySummaryButton(filterLabel = "list") {
  if (!els.activitySummaryButtons) return;
  const normalized = (filterLabel || "").toString().toLowerCase();
  Array.from(els.activitySummaryButtons.querySelectorAll("button")).forEach(
    (btn) => {
      const label =
        btn.getAttribute("activity-summary-style") ||
        btn.dataset.filter ||
        btn.textContent ||
        "";
      btn.classList.toggle(
        "active",
        label.toString().toLowerCase() === normalized
      );
    }
  );
}

export function addActivityTypeFilterButtons(activities, onFilterChange) {
  if (!els.activityFilterButtons) return;

  const activityTypes = [
    ...new Set(activities.map((a) => a.type).filter(Boolean)),
  ];
  const container = els.activityFilterButtons;

  Array.from(container.querySelectorAll("button")).forEach((btn, idx) => {
    if (idx === 0) {
      btn.dataset.filter = "All";
      btn.textContent = "All";
      btn.classList.add("active");
      return;
    }
    btn.remove();
  });

  activityTypes.forEach((type) => {
    const label = String(type).trim();
    if (!label) return;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label.split(/(?=[A-Z])/).join(" ");
    button.dataset.filter = label;

    container.appendChild(button);
  });

  if (!state.activityFilterHandlerBound) {
    container.addEventListener("click", (e) => {
      const button = e.target.closest("button");
      if (!button || !container.contains(button)) return;

      const filterValue =
        (button.dataset.filter || button.textContent || "").trim() || "All";
      state.currentActivityFilter = filterValue;
      setActiveActivityFilterButton(filterValue);
      onFilterChange?.();
    });
    state.activityFilterHandlerBound = true;
  }

  const availableFilters = ["All", ...activityTypes];
  if (!availableFilters.includes(state.currentActivityFilter)) {
    state.currentActivityFilter = "All";
  }
  setActiveActivityFilterButton(state.currentActivityFilter);
}

export function bindPaginationControls() {
  if (!els.prevPage || !els.nextPage) return;
  els.prevPage.addEventListener("click", () => {
    if (state.currentPage === 1) return;
    state.currentPage -= 1;
    renderCurrentPage();
  });

  els.nextPage.addEventListener("click", () => {
    const totalPages = getTotalPages();
    if (state.currentPage >= totalPages) return;
    state.currentPage += 1;
    renderCurrentPage();
  });
}

export function bindListToggle() {
  if (!els.list) return;
  els.list.addEventListener("click", (event) => {
    const focusButton = event.target.closest("[data-activity-focus]");
    if (focusButton) {
      const activityId = focusButton.getAttribute("data-activity-focus");
      const activity = state.displayActivities.find(
        (a) => String(a.id) === String(activityId)
      );
      if (activity && state.mapInstance) {
        focusActivity(state.mapInstance, activity);
      }
      return;
    }

    const toggle = event.target.closest("[data-activity-toggle]");
    if (!toggle) return;
    const activityId = toggle.getAttribute("data-activity-toggle");
    if (!activityId) return;
    const key = String(activityId);
    if (state.expandedActivities.has(key)) {
      state.expandedActivities.delete(key);
    } else {
      state.expandedActivities.add(key);
    }
    renderCurrentPage();
  });
}
