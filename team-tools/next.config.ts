import type { NextConfig } from "next";
import os from "node:os";

/**
 * Allow Server Actions from ANY origin. This is a personal, LAN-hosted tool, so the
 * cross-origin (CSRF) check that Next runs on Server Actions just gets in the way —
 * it silently blocks every navy submit button (and the mark-as-viewed effect) when
 * another device opens the site by this machine's IP/hostname instead of localhost.
 *
 * Next's matcher compares the request's `origin` host (which includes the port,
 * e.g. "192.168.1.23:3000") against this list: an exact match, or a per-dot-segment
 * wildcard. A bare "*" is explicitly rejected, so to match everything we enumerate
 * a wildcard for each realistic segment count (IPv4 = 4, host.local/domains = 2–3),
 * and add exact entries for single-segment hosts (which can't be wildcarded).
 */
function allowAllOrigins(): string[] {
  const origins = new Set<string>();

  // Wildcard for any dotted host: "*.*" (host.local), "*.*.*" (a.b.com),
  // "*.*.*.*" (an IPv4), … up to 8 segments. The port rides in the last segment.
  for (let n = 2; n <= 8; n++) origins.add(Array(n).fill("*").join("."));

  // Single-segment hosts (a bare machine name, "localhost") can't be wildcarded —
  // list this machine's name and localhost, with and without the dev port.
  const port = process.env.PORT ?? "3000";
  const singles = new Set<string>(["localhost"]);
  try {
    singles.add(os.hostname().toLowerCase());
  } catch {
    /* best effort */
  }
  for (const h of singles) {
    origins.add(h);
    origins.add(`${h}:${port}`);
  }

  // Manual escape hatch for anything odd (a tunnel domain, a non-3000 port host).
  for (const extra of (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim())) {
    if (extra) origins.add(extra);
  }
  return [...origins];
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos (player/staff/media header images) are capped at 5MB in the actions;
      // give room for that plus multipart overhead. Default is only 1MB.
      bodySizeLimit: "6mb",
      allowedOrigins: allowAllOrigins(),
    },
  },
};

export default nextConfig;
