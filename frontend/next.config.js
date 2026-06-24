/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.thepromenadeshopsatbriargate.com",
      },
      {
        protocol: "https",
        hostname: "cdn-files.eu.placewise.com",
      },
    ],
  },
};

module.exports = nextConfig;
