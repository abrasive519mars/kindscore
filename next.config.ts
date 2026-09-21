import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "localhost";

const nextConfig: NextConfig = {
  images: {
    // Charity covers and galleries the admin uploads live in the public charity-media bucket.
    remotePatterns: [
      {
        protocol: supabaseHost === "localhost" || supabaseHost === "127.0.0.1" ? "http" : "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Proof screenshots (PRD §09) are capped at 5 MB in PROOF_UPLOAD; the form envelope needs a little more.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
