/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@gai/shared"],
  output: "standalone",
};

export default nextConfig;
