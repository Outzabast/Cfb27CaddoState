import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos (player/staff/media header images) are capped at 5MB in the actions;
      // give room for that plus multipart overhead. Default is only 1MB.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
