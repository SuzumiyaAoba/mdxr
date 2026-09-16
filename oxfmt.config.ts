import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // `.mdx` documents use `:::directive` container syntax — reflowing them into
  // single-line paragraphs breaks remark-directive parsing.
  ignorePatterns: [...(ultracite.ignorePatterns ?? []), "**/*.mdx"],
});
