import withPWA from "next-pwa"

const pwaConfig = withPWA({
  dest: "public",
  register: false,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/\/_next\/static\/chunks\/.*\.js$/],

  // ✅ 핵심: runtimeCaching 커스터마이즈
  runtimeCaching: [
    // 1) Vercel analytics는 캐싱/가로채기 제외 (오프라인시 no-response 줄임)
    {
      urlPattern: /^\/_vercel\/insights\/.*$/i,
      handler: "NetworkOnly",
      method: "GET",
    },

    // 2) Next App Router RSC 요청 제외 ( ?_rsc=... )
    {
      urlPattern: ({ url }) => url.searchParams.has("_rsc"),
      handler: "NetworkOnly",
      method: "GET",
    },

    // 3) start_url 캐시 (앱 설치 후 첫 진입 안정화)
    {
      urlPattern: ({ url }) => url.pathname === "/home",
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "start-url",
      },
    },

    // 4) 정적 자산 캐시
    {
      urlPattern: /^\/_next\/static\/.*/i,
      handler: "CacheFirst",
      method: "GET",
      options: {
        cacheName: "next-static",
      },
    },
    {
      urlPattern: /\.(?:css|js)$/i,
      handler: "StaleWhileRevalidate",
      method: "GET",
      options: {
        cacheName: "static-resources",
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|ico)$/i,
      handler: "StaleWhileRevalidate",
      method: "GET",
      options: {
        cacheName: "images",
      },
    },

    // 5) 그 외는 NetworkFirst (필요시)
    {
      urlPattern: ({ url }) => url.origin === self.location.origin,
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "pages",
        networkTimeoutSeconds: 3,
      },
    },
  ],
})

const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  turbopack: {},
}

export default pwaConfig(nextConfig)
