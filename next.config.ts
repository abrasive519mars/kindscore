import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Proof screenshots (PRD §09) are capped at 5 MB in PROOF_UPLOAD; the form envelope needs a little more.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
