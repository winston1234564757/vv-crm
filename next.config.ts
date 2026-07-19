import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// Fix: Node 22.22.x + Webpack WasmHash incompatibility
// https://github.com/webpack/webpack/issues/14532
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack(config) {
    // Fix: Node 22.22.x + Webpack WasmHash (xxhash-wasm) incompatibility
    // Falls back to md4 — a native crypto hash, no WASM required
    config.output = {
      ...config.output,
      hashFunction: "md4",
      hashDigest: "hex",
    };
    return config;
  },
};

const isVercel = process.env.VERCEL === "1";
export default isVercel ? nextConfig : withSerwist(nextConfig);

