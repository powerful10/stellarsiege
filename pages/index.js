export async function getServerSideProps(ctx) {
  const resolvedUrl = ctx && ctx.resolvedUrl ? String(ctx.resolvedUrl) : "/";
  const qIndex = resolvedUrl.indexOf("?");
  const search = qIndex >= 0 ? resolvedUrl.slice(qIndex) : "";

  return {
    redirect: {
      destination: `/game/index.html${search}`,
      permanent: false,
    },
  };
}

export default function Home() {
  return null;
}

