import { createHash } from "node:crypto";

/**
 * Gravatar URL for an email. `d=404` makes Gravatar return HTTP 404 when the
 * person has no avatar, so the <Avatar> fallback chain can move on to the
 * next candidate (or the initials circle).
 */
export function gravatarUrl(email: string | null | undefined, size = 96): string | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return null;
  const hash = createHash("sha256").update(e).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}

/**
 * A site's favicon via DuckDuckGo's icon service. Returns 404 for unknown
 * domains, which again lets the <Avatar> fallback chain continue.
 */
export function faviconUrl(websiteUrl: string | null | undefined): string | null {
  if (!websiteUrl) return null;
  try {
    const host = new URL(
      websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
    ).hostname;
    if (!host) return null;
    return `https://icons.duckduckgo.com/ip3/${host}.ico`;
  } catch {
    return null;
  }
}
