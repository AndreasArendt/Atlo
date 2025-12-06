export function setStatus(text, color = "var(--muted)") {
  const el = document.getElementById("status");
  el.textContent = text;
  el.style.color = color;
}

export function renderList(activities, listEl) {
  listEl.innerHTML = activities
    .map(a => `
      <li>
        <strong>${a.name || "Activity"}</strong> — ${a.type} —
        ${new Date(a.date).toLocaleDateString()}
      </li>
    `)
    .join("");
}