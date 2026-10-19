import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // bcrypt cost 10 is deliberately slow (00-global §3). Hashing plus two verifies
    // takes well over the 5 s default on a low-end machine, so give tests headroom
    // rather than lowering the cost. The assertions are unchanged.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
