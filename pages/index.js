export async function getServerSideProps() {
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
