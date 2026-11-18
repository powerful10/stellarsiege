import fs from "fs";
import path from "path";

export async function getServerSideProps({ res }) {
  try {
    const filePath = path.join(process.cwd(), "public", "game", "index.html");
    if (fs.existsSync(filePath)) {
      const html = fs.readFileSync(filePath, "utf-8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.write(html);
      res.end();
      return { props: {} };
    }
  } catch (err) {
    // fallback to redirect if file read fails
  }

  return {
    redirect: {
      destination: "/game",
      permanent: false,
    },
  };
}

export default function HomeRedirectPage() {
  return null;
}
