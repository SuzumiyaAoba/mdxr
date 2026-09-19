/// <reference types="vitest/config" />
import path from "node:path";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite-plus";

import oxfmtConfig from "./oxfmt.config";
import oxlintConfig from "./oxlint.config";

// The storybook project runs component tests in a real browser.
// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
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
    projects: [
      {
        extends: true,
        test: {
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(import.meta.dirname, ".storybook"),
          }),
        ],
        test: {
          browser: {
            enabled: true,
            headless: true,
            instances: [{ browser: "chromium" }],
            provider: playwright({}),
          },
          name: "storybook",
        },
      },
    ],
  },
});
