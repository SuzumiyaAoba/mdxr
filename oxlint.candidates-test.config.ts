import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, vitest],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "src/components/**",
    "src/hooks/**",
    "src/lib/**",
  ],
  options: { typeAware: true, typeCheck: true },
  rules: {
    "eslint/no-console": "error",
    "eslint/no-implicit-coercion": "error",
    "eslint/no-useless-assignment": "error",
    "import/no-anonymous-default-export": "error",
    "import/no-commonjs": "error",
    "jsx-a11y/no-autofocus": "error",
    "promise/always-return": "error",
    "promise/catch-or-return": "error",
    "react/jsx-boolean-value": "error",
    "react/no-array-index-key": "error",
    "react/no-unknown-property": "error",
    "react/only-export-components": "error",
    "typescript/explicit-function-return-type": "error",
    "typescript/no-require-imports": "error",
    "typescript/no-unnecessary-condition": "error",
    "typescript/no-var-requires": "error",
    "typescript/require-await": "error",
    "unicorn/explicit-length-check": "error",
    "unicorn/prefer-global-this": "error",
  },
});
