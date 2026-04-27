/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "whatsapp-web.js"],
  outputFileTracingIncludes: {
    '/**': ['./node_modules/@sparticuz/chromium/bin/*'],
  },
};

export default nextConfig;
