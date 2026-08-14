import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.DATABASE_URL ?? "mysql://stwr:stwr@localhost:3306/stwr",
      WEB_ORIGIN: "http://localhost:3000",
      SESSION_COOKIE_NAME: "stwr_session",
      COOKIE_SECURE: "false",
      COOKIE_SAMESITE: "lax",
      EXPOSE_DEMO_RESET_TOKEN: "true",
      PORT: "3001",
    },
  },
});
