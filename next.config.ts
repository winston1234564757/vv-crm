import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// Fix: Webpack WasmHash instability -> "Cannot read properties of undefined
// (reading 'length')" during "Creating an optimized production build".
// https://github.com/webpack/webpack/issues/14532
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /*
       * Прийом у ремонт шле фото стану тим самим Server Action, що й поля
       * форми. Ліміт за замовчуванням — 1 МБ, а два кадри з телефона його
       * перевищують навіть після стиснення: запит відпадав із 413 ще до
       * сервера, і сторінка показувала «Помилка завантаження» замість
       * збереженого ремонту.
       *
       * 4 МБ, а не більше: у Vercel власна стеля на тіло запиту до
       * serverless-функції (4.5 МБ), і перевищення дало б ту саму відмову,
       * тільки вже на рівні платформи, повз цей ліміт. Клієнт при цьому
       * тримає payload у межах 3 МБ (`downscaleImages`), тож мегабайт
       * лишається на самі поля.
       */
      bodySizeLimit: "4mb",
    },
  },
  // Type errors fail the build. Previously this was `typescript.ignoreBuildErrors:
  // true`, which silently shipped a broken AccessoryRow type to production for a
  // long time. The project now type-checks clean, so keep the gate on.
  webpack(config, { dev }) {
    // "sha256" goes through Node's native crypto.createHash instead of webpack's
    // WASM hashers ("xxhash64" default, and "md4" — which is also WASM, not
    // native crypto, so the old md4 workaround never fixed anything).
    config.output = {
      ...config.output,
      hashFunction: "sha256",
      hashDigest: "hex",
      hashDigestLength: 16,
    };

    // The real cause of the recurring build crash is webpack's persistent
    // filesystem cache: after a large change set it feeds `undefined` into the
    // hasher, which surfaces as "Cannot read properties of undefined (reading
    // 'length')" (WASM hashers) or ERR_INVALID_ARG_TYPE (native ones). A clean
    // build always succeeds, a cached one is a coin flip — including on Vercel,
    // which restores the cache between deployments.
    // Disabled for production builds only; dev keeps its cache and stays fast.
    if (!dev) config.cache = false;

    return config;
  },
};

const isVercel = process.env.VERCEL === "1";
export default isVercel ? nextConfig : withSerwist(nextConfig);

