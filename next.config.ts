import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Hostnames allowed for next/image.
 *
 * Uploaded media (avatar, examiner photo, media library) is served from R2,
 * whose public domain differs per environment, so it is derived from
 * R2_PUBLIC_URL rather than hardcoded. Without this, every uploaded image
 * throws `next-image-unconfigured-host` at runtime.
 */
function hostnameFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname || null;
  } catch {
    return null;
  }
}

const r2Hostnames = [
  hostnameFromUrl(process.env.R2_PUBLIC_URL),
  // Optional custom domain in front of R2, if one is ever added.
  hostnameFromUrl(
    process.env.R2_PUBLIC_URL_CUSTOM ?? process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  ),
].filter((h): h is string => h !== null);

if (r2Hostnames.length === 0) {
  console.warn(
    "[next.config] R2_PUBLIC_URL is not set — uploaded images will fail to load. Add it to .env."
  );
}

/**
 * Only set when running inside a Tauri dev shell. Left undefined otherwise so
 * a plain `next dev` / `next start` always serves assets from its own origin.
 */
const internalHost = process.env.TAURI_DEV_HOST;

const nextConfig: NextConfig = {
  /*
   * NOTE: `output: "export"` is intentionally NOT enabled.
   * This app runs Server Actions, Better Auth sessions and Drizzle/Postgres,
   * none of which work in a fully static export.
   */
  assetPrefix: !isProd && internalHost ? `http://${internalHost}:3000` : undefined,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "logo.clearbit.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
       {
        protocol: "https",
        hostname: "rv49x.vercel.app",
      },
      {
        protocol: "https",
        hostname: "encrypted-tbn0.gstatic.com",
      },
      // Uploaded media on R2 — derived from R2_PUBLIC_URL.
      ...r2Hostnames.map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/**",
      })),
    ],
  },
};

export default nextConfig;
