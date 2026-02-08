import withPWA from "next-pwa"

const pwaConfig = withPWA({
  dest: "public",
  register: false,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  // Disable Workbox precache to avoid stale chunk 404s.
  // A minimal custom /public/sw.js is used instead.
  disable: true,
})

const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  turbopack: {},
}

export default pwaConfig(nextConfig)
