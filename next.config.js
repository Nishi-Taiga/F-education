/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ["@radix-ui/react-toast"],
}

module.exports = nextConfig
