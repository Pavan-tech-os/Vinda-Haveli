/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  experimental: { outputFileTracingIncludes: { '/**/*': ['./db/**/*'] } },
};