import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    /* Пояс тестів прибитий до того самого, що й у рантаймі (`instrumentation.ts`).
       Vitest не викликає next-хук `register()`, тож без цього рядка тести годин
       зелені лише на машині, яка випадково стоїть у Києві. */
    env: { TZ: "Europe/Kyiv" },
    coverage: {
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/types/**", "src/**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
