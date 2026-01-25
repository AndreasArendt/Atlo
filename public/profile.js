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
    setDeleteStatus("—", "muted");
  } catch (err) {
    console.error("Profile load failed:", err);
    showLogin();
    setStatus("Connect Strava to edit your profile.", "error");
    setDeleteStatus("—", "muted");
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

  setStatus("Saving...", "muted");
  try {
    const res = await fetch("/api/profile", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restingHeartRate: resting }),
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
