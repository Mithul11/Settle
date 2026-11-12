import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the Next.js "N" dev badge; compile and runtime errors still show.
  devIndicators: false,
  // Every app page reads live deal and payment data, so pages render per
  // request (see `export const dynamic` in the routes).
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
