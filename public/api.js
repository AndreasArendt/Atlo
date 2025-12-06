export async function api(path) {
  const res = await fetch(path);

  if (res.status === 401 || res.status === 404) {
    throw new Error("Not authenticated. Click Connect Strava.");
  }

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
