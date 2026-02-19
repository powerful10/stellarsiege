function originFromReq(req) {
  const protoHeader = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers["x-forwarded-host"] || req.headers.host || "localhost:8787";
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || "https";
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  return `${proto}://${host}`;
}

function buildUrl(loc, changefreq = "weekly", priority = "0.8") {
  return [
    "<url>",
    `<loc>${loc}</loc>`,
    `<changefreq>${changefreq}</changefreq>`,
    `<priority>${priority}</priority>`,
    "</url>",
  ].join("");
}

export async function getServerSideProps({ req, res }) {
  const origin = originFromReq(req);
  const urls = [
    buildUrl(`${origin}/`, "daily", "1.0"),
    buildUrl(`${origin}/game/index.html`, "daily", "1.0"),
    buildUrl(`${origin}/game/info.html`, "weekly", "0.8"),
    buildUrl(`${origin}/privacy.html`, "monthly", "0.5"),
    buildUrl(`${origin}/terms.html`, "monthly", "0.5"),
  ].join("");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
  ].join("");

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.write(xml);
  res.end();

  return { props: {} };
}

export default function SiteMap() {
  return null;
}
