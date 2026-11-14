import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "localhost";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }],
  },
  // Short bio links: forward to the home page with a source tag (counted as a "Visit from" event in layout.tsx).
  async redirects() {
    return [
      { source: "/tiktok", destination: "/?utm_source=tiktok", permanent: false },
      { source: "/instagram", destination: "/?utm_source=instagram", permanent: false },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
