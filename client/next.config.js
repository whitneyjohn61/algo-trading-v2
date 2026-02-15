/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000',
    NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL || 'debug',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Enable standalone output for Docker deployment
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  // Set output file tracing root to client directory
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [],
  },
}

module.exports = nextConfig
