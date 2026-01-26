import { GOAL_SPORTS, getSportMeta } from "./goals.js";

const formWrap = document.getElementById("profile-form-wrap");
const loginWrap = document.getElementById("profile-login");
const dangerWrap = document.getElementById("profile-danger");
const form = document.getElementById("profile-form");
const statusEl = document.getElementById("profile-status");
const deleteStatusEl = document.getElementById("profile-delete-status");
const deleteButton = document.getElementById("profile-delete");
const usernameEl = document.getElementById("profile-username");
const maxHrEl = document.getElementById("profile-max-hr");
const restingInput = document.getElementById("resting-hr");
const goalList = document.getElementById("profile-goal-list");
const addGoalButton = document.getElementById("profile-add-goal");

const setStatus = (message, tone = "muted") => {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
};

const setDeleteStatus = (message, tone = "muted") => {
  if (!deleteStatusEl) return;
  deleteStatusEl.textContent = message;
  deleteStatusEl.dataset.tone = tone;
};

const GOAL_OPTIONS = GOAL_SPORTS.map(
  (sport) => `<option value="${sport.id}">${sport.label}</option>`
).join("");

const formatGoalDistance = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return numeric % 1 === 0 ? numeric.toString() : numeric.toFixed(1);
};

const buildGoalRow = (goal = {}) => {
  if (!goalList) return null;
  const row = document.createElement("div");
  row.className = "profile-goal-row";
  row.innerHTML = `
    <select aria-label="Sport">${GOAL_OPTIONS}</select>
    <input type="number" min="1" step="1" placeholder="Distance" inputmode="decimal" />
    <span class="profile-goal-unit">km</span>
    <button type="button" class="profile-goal-remove" aria-label="Remove goal">
      Remove
    </button>
  `;

  const select = row.querySelector("select");
  const input = row.querySelector("input");
  const removeButton = row.querySelector("button");
  const meta = getSportMeta(goal?.sport);
  if (select && meta?.id) {
    select.value = meta.id;
  }
  if (input) {
    const distance = Number(goal?.distanceKm ?? goal?.distance);
    input.value = formatGoalDistance(distance);
  }
  if (removeButton) {
    removeButton.addEventListener("click", () => {
      row.remove();
    });
  }
  return row;
};

const renderGoals = (goals = []) => {
  if (!goalList) return;
  goalList.innerHTML = "";
  const list = Array.isArray(goals) ? goals : [];
  if (!list.length) {
    const emptyRow = buildGoalRow({});
    if (emptyRow) goalList.appendChild(emptyRow);
    return;
  }
  list.forEach((goal) => {
    const row = buildGoalRow(goal);
    if (row) goalList.appendChild(row);
  });
};

const collectGoals = () => {
  if (!goalList) return [];
  const rows = Array.from(goalList.querySelectorAll(".profile-goal-row"));
  const seen = new Set();
  const goals = [];
  for (const row of rows) {
    const select = row.querySelector("select");
    const input = row.querySelector("input");
    const sport = select?.value?.trim() || "";
    const rawDistance = input?.value?.trim() || "";
    if (!sport && !rawDistance) continue;
    const distance = Number(rawDistance);
    if (!sport || !Number.isFinite(distance) || distance <= 0) {
      setStatus("Enter a valid yearly goal distance.", "error");
      return null;
    }
    const meta = getSportMeta(sport);
    const key = meta.id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    goals.push({
      sport: meta.id,
      distanceKm: Math.round(distance * 10) / 10,
    });
  }
  return goals;
};

const formatHr = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  return `${Math.round(numeric)} bpm`;
};

const showLogin = () => {
  if (formWrap) formWrap.hidden = Boolean(loginWrap);
  if (loginWrap) loginWrap.hidden = false;
  if (dangerWrap) dangerWrap.hidden = true;
};

const showForm = () => {
  if (formWrap) formWrap.hidden = false;
  if (loginWrap) loginWrap.hidden = true;
  if (dangerWrap) dangerWrap.hidden = false;
};

const fillProfile = (data = {}) => {
  if (usernameEl) {
    usernameEl.textContent = data?.username || "—";
  }
  if (maxHrEl) {
    maxHrEl.textContent = formatHr(data?.maxHeartRate);
  }
  if (restingInput) {
    const resting = Number(data?.restingHeartRate);
    restingInput.value =
      Number.isFinite(resting) && resting > 0 ? Math.round(resting) : "";
  }
  renderGoals(data?.yearlyGoals);
};

async function loadProfile() {
  setStatus("Loading profile...", "muted");
  try {
    const res = await fetch("/api/profile", { credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json().catch(() => ({}));
    fillProfile(data);
    showForm();
    setStatus("", "muted");
    setDeleteStatus("", "muted");
  } catch (err) {
    console.error("Profile load failed:", err);
    showLogin();
    setStatus("Connect Strava to edit your profile.", "error");
    setDeleteStatus("", "muted");
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const restingValue = restingInput?.value?.trim();
  const resting = restingValue ? Number(restingValue) : null;
  if (resting !== null && (!Number.isFinite(resting) || resting <= 0)) {
    setStatus("Enter a valid resting heart rate.", "error");
    return;
  }
  const yearlyGoals = collectGoals();
  if (yearlyGoals === null) {
    return;
  }

  setStatus("Saving...", "muted");
  try {
    const res = await fetch("/api/profile", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restingHeartRate: resting, yearlyGoals }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json().catch(() => ({}));
    fillProfile(data);
    setStatus("Saved.", "success");
  } catch (err) {
    console.error("Profile save failed:", err);
    setStatus("Save failed. Try again.", "error");
  }
}

if (form) {
  form.addEventListener("submit", saveProfile);
}

if (addGoalButton && goalList) {
  addGoalButton.addEventListener("click", () => {
    const row = buildGoalRow({});
    if (row) goalList.appendChild(row);
  });
}

async function deleteProfileData() {
  if (!deleteButton) return;
  const confirmed = window.confirm(
    "Delete all your Atlo data? This cannot be undone."
  );
  if (!confirmed) return;

  deleteButton.disabled = true;
  setDeleteStatus("Deleting...", "muted");

  try {
    const res = await fetch("/api/profile", {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error(await res.text());
    fillProfile({});
    setStatus("Data deleted. Please reconnect.", "success");
    setDeleteStatus("Data deleted.", "success");
    showLogin();
  } catch (err) {
    console.error("Profile delete failed:", err);
    setDeleteStatus("Delete failed. Try again.", "error");
  } finally {
    deleteButton.disabled = false;
  }
}

if (deleteButton) {
  deleteButton.addEventListener("click", deleteProfileData);
}

loadProfile();
