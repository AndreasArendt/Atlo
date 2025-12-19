export function createCookie(
  name,
  value,
  { maxAge, httpOnly = true, sameSite = "Lax", secure, domain } = {}
) {
  const isLocal =
    process.env.VERCEL_ENV === "development" ||
    process.env.NODE_ENV === "development";

  const parts = [`${name}=${value}`, "Path=/"];

  if (httpOnly) parts.push("HttpOnly");
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  const resolvedDomain = domain ?? process.env.COOKIE_DOMAIN;
  if (resolvedDomain) parts.push(`Domain=${resolvedDomain}`);

  if (typeof maxAge === "number") parts.push(`Max-Age=${maxAge}`);
  if (!isLocal || secure) parts.push("Secure");

  return parts.join("; ");
}
