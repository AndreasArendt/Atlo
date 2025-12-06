import { api } from "./api.js";
import { drawPolylines } from "./map-utils.js";
import { setStatus, renderList } from "./ui.js";

const els = {
  connect: document.getElementById("connect"),
  refresh: document.getElementById("refresh"),
  status: document.getElementById("status"),
  list: document.getElementById("list"),
  count: document.getElementById("count"),
  canvas: document.getElementById("map"),
};

let activities = [];

async function loadActivities() {
  setStatus("Loading activities…");

  try {
    activities = await api("/api/activities");

    els.count.textContent = activities.length.toString();
    renderList(activities, els.list);

    drawPolylines(activities, els.canvas);

    setStatus("Activities loaded.", "var(--success)");
  } catch (err) {
    console.error(err);
    setStatus(err.message, "var(--error)");
  }
}

els.connect.onclick = () => {
  window.location.href = "/api/start";
};

els.refresh.onclick = loadActivities;

// Load on startup
loadActivities();
