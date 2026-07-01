/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Temporary: redirect root to dashboard until landing page (Task 16) is built
      { source: '/', destination: '/dashboard', permanent: false },
    ]
  },
}
export default nextConfig
