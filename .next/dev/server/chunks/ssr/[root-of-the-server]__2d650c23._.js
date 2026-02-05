module.exports = [
"[project]/pages/index.js [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home,
    "getServerSideProps",
    ()=>getServerSideProps
]);
async function getServerSideProps(ctx) {
    const resolvedUrl = ctx && ctx.resolvedUrl ? String(ctx.resolvedUrl) : "/";
    const qIndex = resolvedUrl.indexOf("?");
    const search = qIndex >= 0 ? resolvedUrl.slice(qIndex) : "";
    return {
        redirect: {
            destination: `/game/index.html${search}`,
            permanent: false
        }
    };
}
function Home() {
    return null;
}
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__2d650c23._.js.map