/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core", "whatsapp-web.js"],
};

export default nextConfig;
