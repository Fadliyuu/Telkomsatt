/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },

  // ─── Security Headers ────────────────────────────────────────────────────────
  // Applied to all routes. Adjust CSP directives as needed when adding new
  // third-party scripts or fonts.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Prevent MIME-type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Enforce HTTPS (1 year, include subdomains)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Control referrer information
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Restrict browser features
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Content Security Policy
          // 'unsafe-eval' is required by Next.js in development mode only.
          // Firebase SDK requires 'unsafe-inline' for some inline scripts.
          // Cloudinary images are served from res.cloudinary.com.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Tesseract v7 loads its worker/core from jsDelivr; eval also permits WASM.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://cdn.jsdelivr.net",
              // Styles: self + inline (Tailwind)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + Cloudinary + data URIs (for QR codes)
              "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
              // Tesseract downloads WASM and Indonesian/English language data from jsDelivr.
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://api.cloudinary.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://cdn.jsdelivr.net",
              // Workers (needed for some QR libraries)
              "worker-src 'self' blob:",
              // Camera access for QR scanner
              "media-src 'self' blob:",
              "frame-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
