/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ["@anon-aadhaar/core"],
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
