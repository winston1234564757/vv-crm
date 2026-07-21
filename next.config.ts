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
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack(config) {
    // Both of webpack's default hashers are WASM-backed: "xxhash64" (default)
    // and "md4" (webpack ships its own md4 WASM build — it is NOT native crypto,
    // which is why the previous md4 workaround did not actually fix anything and
    // the crash kept resurfacing on incremental/cached builds).
    // "sha256" routes through Node's native crypto.createHash — no WASM, no pool
    // corruption. Slightly slower to hash, but builds stop being a lottery.
    config.output = {
      ...config.output,
      hashFunction: "sha256",
      hashDigest: "hex",
      hashDigestLength: 16,
    };
    return config;
  },
};

const isVercel = process.env.VERCEL === "1";
export default isVercel ? nextConfig : withSerwist(nextConfig);

