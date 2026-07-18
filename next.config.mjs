/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude server-side modules from client bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        '@prisma/client': false,
        '@prisma/adapter-pg': false,
      }
    }
    return config
  },
}
export default nextConfig
