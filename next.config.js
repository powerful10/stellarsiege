/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/game/hangar",
        destination: "/hangar",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/game/survival/start", destination: "/game/index.html" },
      { source: "/game/campaign", destination: "/game/index.html" },
      { source: "/game/campaign/start", destination: "/game/index.html" },
      { source: "/game/campaign/start/:level", destination: "/game/index.html" },
      { source: "/game/onlinematch", destination: "/game/index.html" },
      { source: "/game/onlinematch/start", destination: "/game/index.html" },
      { source: "/game/leaderboard", destination: "/game/index.html" },
      { source: "/game/account", destination: "/game/index.html" },
    ];
  },
};

module.exports = nextConfig;
