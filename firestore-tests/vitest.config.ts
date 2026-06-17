import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 20000,
    // The rules emulator is a single shared resource; run test files serially
    // to avoid cross-file interference on seeded data.
    fileParallelism: false,
  },
});
