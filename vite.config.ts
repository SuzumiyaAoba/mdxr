import { defineConfig } from "vite-plus";

import oxfmtConfig from "./oxfmt.config";
import oxlintConfig from "./oxlint.config";

export default defineConfig({
  fmt: oxfmtConfig,
  lint: oxlintConfig,
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
