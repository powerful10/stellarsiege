function toSearch(query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v != null) params.append(key, String(v));
      });
      return;
    }
    if (value != null) params.append(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

export async function getServerSideProps(ctx) {
  const search = toSearch(ctx.query);
  return {
    redirect: {
      destination: `/game/hangar${search}`,
      permanent: false,
    },
  };
}

export default function HangarRedirectPage() {
  return null;
}
