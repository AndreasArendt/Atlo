import { els } from "./dom.js";
import { state } from "./state.js";

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
}

export function applyRange(range, onRangeSelected) {
  const end = new Date();
  const start = new Date(end);

  switch (range) {
    case "week":
      start.setDate(end.getDate() - 7);
      setDateInputs(start, end);
      break;
    case "month":
      start.setMonth(end.getMonth() - 1);
      setDateInputs(start, end);
      break;
    case "year":
      start.setFullYear(end.getFullYear() - 1);
      setDateInputs(start, end);
      break;
    default:
      start.setFullYear(2009, 2, 1);
      setDateInputs(start, end);
      els.rangeLabel.textContent = "All";
      break;
  }

  highlightQuick(range);
  onRangeSelected?.();
}

export function bindRangeButtons(onRangeSelected) {
  els.quickButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyRange(btn.dataset.range, onRangeSelected));
  });
}
