export async function api(path, options = {}) {
  const init = { ...options };
  if (
    init.body &&
    typeof init.body === "object" &&
    !(init.body instanceof FormData)
  ) {
    init.headers = {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    };
    init.body = JSON.stringify(init.body);
  }

  const res = await fetch(path, init);

  if (res.status === 401 || res.status === 404) {
    throw new Error("Not authenticated. Click Connect Strava.");
  }

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
