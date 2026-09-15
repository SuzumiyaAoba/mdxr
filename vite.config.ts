import ultraciteFmt from "ultracite/oxfmt";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: { ...ultraciteFmt },
  lint: {
    extends: [core, react, vitest],
    ignorePatterns: core.ignorePatterns,
    options: { typeAware: true, typeCheck: true },
  },
  pack: {
    dts: true,
    entry: {
      cli: "src/cli.ts",
      components: "src/components.ts",
      index: "src/index.ts",
    },
    format: "esm",
    platform: "node",
    sourcemap: false,
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
