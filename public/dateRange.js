import { els } from "./dom.js";
import { state } from "./state.js";

const RANGE_LABELS = {
  week: "Last week",
  "calendar-week": "This week",
  month: "Last month",
  "calendar-month": "This month",
  year: "Last year",
  "calendar-year": "This year",
};

const RANGE_GROUP_LOOKUP = {
  week: "week",
  "calendar-week": "week",
  month: "month",
  "calendar-month": "month",
  year: "year",
  "calendar-year": "year",
};

const CHOOSERS = {
  week: {
    chooser: () => els.quickWeekChooser,
    label: () => els.quickWeekLabel,
  },
  month: {
    chooser: () => els.quickMonthChooser,
    label: () => els.quickMonthLabel,
  },
  year: {
    chooser: () => els.quickYearChooser,
    label: () => els.quickYearLabel,
  },
};

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday as start of week
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const toInputValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - tzOffset * 60000);
  return local.toISOString().split("T")[0];
};

export const formatRangeLabel = (start, end) => {
  if (start === "all" || end === "all") {
    return "All";
  }
  const opts = { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} → ${end.toLocaleDateString(
    undefined,
    opts
  )}`;
};

function updateChoosers(range) {
  const activeGroup = RANGE_GROUP_LOOKUP[range];
  Object.entries(CHOOSERS).forEach(([groupKey, refs]) => {
    const chooserEl = refs.chooser();
    if (chooserEl) {
      chooserEl.classList.toggle("active", groupKey === activeGroup);
    }
    if (groupKey !== activeGroup) return;

    const labelEl = refs.label?.();
    if (!labelEl) return;
    const matchingButton = Array.from(els.quickButtons || []).find(
      (btn) => btn.dataset.range === range
    );
    const label =
      matchingButton?.dataset.label ||
      matchingButton?.textContent?.trim() ||
      RANGE_LABELS[range];

    if (label) {
      labelEl.textContent = label;
    }
  });
}

function syncRangePickerFromInputs() {
  if (!state.rangePickerInstance) return;
  const startValue = els.startDate.value;
  const endValue = els.endDate.value;
  if (!startValue || !endValue) return;
  state.rangePickerInstance.setDate([startValue, endValue], false);
}

export function setDateInputs(startDate, endDate, syncPicker = true) {
  const isAll = startDate === "all" || endDate === "all";
  els.startDate.value = isAll ? "" : toInputValue(startDate);
  els.endDate.value = isAll ? "" : toInputValue(endDate);
  els.rangeLabel.textContent = formatRangeLabel(startDate, endDate);
  if (syncPicker) {
    syncRangePickerFromInputs();
  }
}

export function getDateRange() {
  const start = new Date(els.startDate.value);
  const end = new Date(els.endDate.value);
  return { start, end };
}

function handleRangeSelection(selectedDates, onRangeSelected) {
  if (!Array.isArray(selectedDates) || selectedDates.length < 2) return;
  const [startDate, endDate] = selectedDates;
  if (!startDate || !endDate) return;
  setDateInputs(startDate, endDate, false);
  highlightQuick(null);
  onRangeSelected?.();
}

export function initRangePicker(onRangeSelected) {
  const flatpickrLib = window.flatpickr;
  if (!flatpickrLib || !els.rangePickerInput) return;

  if (state.rangePickerInstance) {
    state.rangePickerInstance.destroy();
  }

  state.rangePickerInstance = flatpickrLib(els.rangePickerInput, {
    dateFormat: "Y-m-d",
    defaultDate: [els.startDate.value, els.endDate.value],
    mode: "range",
    allowInput: false,
    disableMobile: true,
    position: "below",
    positionElement: els.endDate || els.startDate,
    onClose: (dates) => handleRangeSelection(dates, onRangeSelected),
  });

  [els.startDate, els.endDate].forEach((input) => {
    input?.addEventListener("click", () => {
      if (state.rangePickerInstance) {
        state.rangePickerInstance.open();
      }
    });
  });
}

export function highlightQuick(range) {
  els.quickButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.range === range);
  });
  updateChoosers(range);
}

export function applyRange(range, onRangeSelected) {
  const today = new Date();
  let start = new Date(today);
  let end = new Date(today);

  switch (range) {
    case "week":
      {
        const currentWeekStart = startOfWeek(today);
        end = new Date(currentWeekStart);
        end.setDate(end.getDate() - 1);
        start = startOfWeek(end);
      }
      break;
    case "calendar-week":
      start = startOfWeek(today);
      end = new Date(today);
      break;
    case "month":
      {
        const currentMonthStart = startOfMonth(today);
        end = new Date(currentMonthStart);
        end.setDate(0); // last day of previous month
        start = startOfMonth(end);
      }
      break;
    case "calendar-month":
      start = startOfMonth(today);
      end = new Date(today);
      break;
    case "year":
      start.setFullYear(today.getFullYear() - 1);
      end = new Date(today);
      break;
    case "calendar-year":
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today);
      break;
    case "all":
      start = new Date(2009, 2, 1);
      end = new Date(today);
      setDateInputs(start, end);
      els.rangeLabel.textContent = "All";
      highlightQuick(range);
      onRangeSelected?.();
      return;
    default:
      return;
  }

  setDateInputs(start, end);
  highlightQuick(range);
  onRangeSelected?.();
}

export function bindRangeButtons(onRangeSelected) {
  els.quickButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyRange(btn.dataset.range, onRangeSelected);
      btn.closest("details")?.removeAttribute("open");
    });
  });
}
