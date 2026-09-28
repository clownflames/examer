import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

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
    ],
  },
};

export default nextConfig;
