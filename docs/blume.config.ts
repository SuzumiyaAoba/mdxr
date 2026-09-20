import { defineConfig } from "blume";

export default defineConfig({
  ai: {
    llmsTxt: true,
  },
  // GitHub Pages project site: https://suzumiyaaoba.github.io/mdxr
  deployment: {
    base: "/mdxr",
    site: "https://suzumiyaaoba.github.io",
  },
  description:
    "Render agent-authored MDX documents to standalone HTML with a semantic component catalog.",
  github: {
    branch: "master",
    dir: "docs",
    owner: "SuzumiyaAoba",
    repo: "mdxr",
  },
  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", label: "English" },
      { code: "ja", label: "日本語" },
    ],
  },
  lastModified: true,
  title: "mdxr",
});
